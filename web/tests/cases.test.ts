import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

import { createIsolatedDatabase } from '@/db/client';
import { getCaseDetail, listCases } from '@/db/repositories/cases';
import {
  auditEvents,
  documentationChecklistItems,
  caseDocuments,
  caseIntakeDocuments,
  caseIntakes,
  priorAuthorizationCases,
  users,
} from '@/db/schema';
import {
  changeCaseStatus,
  changeChecklistStatus,
  createCaseNote,
  registerCaseDocument,
} from '@/lib/cases/workflow-service';
import {
  removeStoredDocument,
  validateAndStoreDocument,
} from '@/lib/documents/local-storage';
import { promoteIntakeToCase } from '@/lib/cases/intake-service';
import { deleteCasePermanently } from '@/lib/cases/delete-service';
import { intakeErrorResponse } from '@/app/api/cases/intake/route';
import { eq } from 'drizzle-orm';

function createCaseFixture() {
  const db = createIsolatedDatabase();
  const now = new Date('2026-09-05T15:00:00.000Z');
  db.insert(users)
    .values({
      id: '63df7092-8224-44d4-a4ba-ddb4ecf725f2',
      username: 'specialist',
      passwordHash: 'argon2id-test-hash',
      displayName: 'Synthetic Specialist',
      role: 'AUTHORIZATION_SPECIALIST',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  db.insert(priorAuthorizationCases)
    .values({
      id: 'RM-PA-2000',
      patientDisplayName: 'Synthetic Patient',
      patientInitials: 'SP',
      requestedEquipment: 'Demo mobility device',
      equipmentCategory: 'Mobility',
      insurerName: 'Demo Health Plan',
      insurerPlan: 'Synthetic PPO',
      status: 'Draft',
      priority: 'Routine',
      assignedSpecialist: 'Synthetic Specialist',
      followUpDue: '2026-09-06',
      createdAt: now,
      updatedAt: now,
    })
    .run();
  db.insert(documentationChecklistItems)
    .values({
      id: 'RM-PA-2000:PHYSICIAN_ORDER',
      caseId: 'RM-PA-2000',
      documentType: 'PHYSICIAN_ORDER',
      label: 'Physician order / prescription',
      status: 'Missing',
      sortOrder: 0,
      updatedAt: now,
    })
    .run();
  return db;
}

void test('case workflow data is persisted and returned through safe domain DTOs', () => {
  const db = createCaseFixture();
  assert.equal(listCases(db)[0]?.missingDocumentationCount, 1);

  assert.equal(
    changeCaseStatus(
      'RM-PA-2000',
      'Pending',
      '63df7092-8224-44d4-a4ba-ddb4ecf725f2',
      db,
    )?.status,
    'Pending',
  );
  assert.equal(
    changeChecklistStatus(
      'RM-PA-2000',
      'RM-PA-2000:PHYSICIAN_ORDER',
      'Received',
      '63df7092-8224-44d4-a4ba-ddb4ecf725f2',
      db,
    )?.status,
    'Received',
  );
  const note = createCaseNote(
    'RM-PA-2000',
    'Synthetic workflow note.',
    '63df7092-8224-44d4-a4ba-ddb4ecf725f2',
    db,
  );
  assert.equal(note.authorDisplayName, 'Synthetic Specialist');

  const document = registerCaseDocument(
    {
      id: 'bff613dd-b10d-4c68-92ac-733d5c3c0478',
      caseId: 'RM-PA-2000',
      documentType: 'PHYSICIAN_ORDER',
      originalFilename: 'sample-order.txt',
      storedFilename: 'cd7f4e9c-d731-429b-a73d-e9ab13c0a901.txt',
      mimeType: 'text/plain',
      fileSize: 42,
    },
    '63df7092-8224-44d4-a4ba-ddb4ecf725f2',
    db,
  );
  assert.equal(document.uploadedByDisplayName, 'Synthetic Specialist');
  assert.equal('storedFilename' in document, false);

  const detail = getCaseDetail('RM-PA-2000', db);
  assert.equal(detail?.status, 'Pending');
  assert.equal(detail?.missingDocumentationCount, 0);
  assert.equal(detail?.notes.length, 1);
  assert.equal(detail?.documents.length, 1);
  assert.deepEqual(
    db
      .select({ action: auditEvents.action })
      .from(auditEvents)
      .all()
      .map(({ action }) => action)
      .sort(),
    [
      'case.checklist_updated',
      'case.document_uploaded',
      'case.note_added',
      'case.status_changed',
    ],
  );
});

void test('local document intake detects content, sanitizes names, and randomizes storage names', async () => {
  const upload = new File(
    ['SYNTHETIC DEMO DOCUMENT\nNo real PHI.'],
    '../unsafe sample?.txt',
    {
      type: 'text/plain',
    },
  );
  const stored = await validateAndStoreDocument(upload);
  try {
    assert.equal(stored.mimeType, 'text/plain');
    assert.equal(stored.originalFilename.includes('/'), false);
    assert.match(stored.storedFilename, /^[0-9a-f-]{36}\.txt$/);
    assert.notEqual(stored.storedFilename, stored.originalFilename);
  } finally {
    await removeStoredDocument(stored.storedFilename);
  }

  const disguised = new File(['plain text'], 'not-really-a-pdf.pdf', {
    type: 'application/pdf',
  });
  await assert.rejects(
    () => validateAndStoreDocument(disguised),
    /extension does not match its contents/i,
  );
});

void test('document-dump promotion commits the canonical case and promoted documents together', async () => {
  const db = createIsolatedDatabase();
  const now = new Date();
  db.insert(users).values({ id: '63df7092-8224-44d4-a4ba-ddb4ecf725f2', username: 'intake-test', passwordHash: 'test', displayName: 'Synthetic Specialist', role: 'AUTHORIZATION_SPECIALIST', isActive: true, createdAt: now, updatedAt: now }).run();
  const intakeId = 'intake-success-regression';
  const relative = path.join('data', 'local', 'intakes', intakeId, 'source.txt');
  await mkdir(path.dirname(path.join(process.cwd(), relative)), { recursive: true });
  await writeFile(path.join(process.cwd(), relative), 'Synthetic source document');
  db.insert(caseIntakes).values({ id: intakeId, createdByUserId: null, status: 'PROPOSED', fieldsJson: '{}', createdAt: now }).run();
  db.insert(caseIntakeDocuments).values({ id: 'intake-doc-success', intakeId, originalFilename: '01_patient-demographics.txt', storedFilename: relative, mimeType: 'text/plain', fileSize: 25, createdAt: now }).run();
  const caseId = await promoteIntakeToCase({ db, intakeId, fields: [{ key: 'patientName', value: 'Synthetic Patient' }, { key: 'requestedEquipment', value: 'Power wheelchair' }], userId: '63df7092-8224-44d4-a4ba-ddb4ecf725f2', userDisplayName: 'Synthetic Specialist', assignToSelf: true });
  assert.match(caseId, /^RM-PA-\d{4}$/);
  assert.equal(listCases(db, true).some((item) => item.id === caseId), true);
  assert.equal(getCaseDetail(caseId, db)?.documents.length, 1);
  assert.equal(db.select().from(caseIntakes).where(eq(caseIntakes.id, intakeId)).get()?.createdCaseId, caseId);
  await rm(path.join(process.cwd(), 'data', 'local', 'intakes', intakeId), { recursive: true, force: true });
  const promoted = db.select().from(caseDocuments).where(eq(caseDocuments.caseId, caseId)).get();
  if (promoted) await rm(path.join(process.cwd(), 'data', 'local', 'uploads', promoted.storedFilename), { force: true });
});

void test('promotion failure rolls back case creation and returns structured JSON', async () => {
  const db = createIsolatedDatabase();
  const now = new Date();
  db.insert(users).values({ id: '63df7092-8224-44d4-a4ba-ddb4ecf725f2', username: 'intake-test', passwordHash: 'test', displayName: 'Synthetic Specialist', role: 'AUTHORIZATION_SPECIALIST', isActive: true, createdAt: now, updatedAt: now }).run();
  const intakeId = 'intake-failure-regression';
  db.insert(caseIntakes).values({ id: intakeId, createdByUserId: null, status: 'PROPOSED', fieldsJson: '{}', createdAt: now }).run();
  db.insert(caseIntakeDocuments).values({ id: 'intake-doc-failure', intakeId, originalFilename: 'missing.txt', storedFilename: 'data/local/intakes/missing/source.txt', mimeType: 'text/plain', fileSize: 10, createdAt: now }).run();
  await assert.rejects(() => promoteIntakeToCase({ db, intakeId, fields: [{ key: 'patientName', value: 'Synthetic Failure' }], userId: '63df7092-8224-44d4-a4ba-ddb4ecf725f2', userDisplayName: 'Synthetic Specialist', copy: async () => { throw new Error('promotion failed'); } }));
  assert.equal(listCases(db, true).length, 0);
  assert.equal(db.select().from(caseIntakes).where(eq(caseIntakes.id, intakeId)).get()?.status, 'PROPOSED');
  const response = intakeErrorResponse(new Error('promotion failed'));
  assert.equal(response.status, 500);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.deepEqual(await response.json(), { success: false, error: 'promotion failed' });
});

void test('permanent case deletion removes case-owned records while preserving users and audit attribution', async () => {
  const db = createCaseFixture();
  const deleted = await deleteCasePermanently({ db, caseId: 'RM-PA-2000', userId: '63df7092-8224-44d4-a4ba-ddb4ecf725f2' });
  assert.equal(deleted, true);
  assert.equal(getCaseDetail('RM-PA-2000', db), undefined);
  assert.equal(listCases(db, true).some((item) => item.id === 'RM-PA-2000'), false);
  assert.equal(db.select().from(users).all().length, 1);
  assert.equal(db.select({ action: auditEvents.action }).from(auditEvents).all().some((event) => event.action === 'case.deleted'), true);
});
