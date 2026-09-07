import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';

import { createIsolatedDatabase, type DatabaseClient } from '@/db/client';
import { getDocumentAnalysis } from '@/db/repositories/document-analyses';
import {
  auditEvents,
  caseDocuments,
  documentAnalyses,
  priorAuthorizationCases,
  users,
  type CaseDocumentRecord,
} from '@/db/schema';
import type { DocumentAnalysisProvider } from '@/lib/ai/document-analysis-provider';
import {
  analyzeDocument,
  DocumentAnalysisServiceError,
  reviewFact,
} from '@/lib/ai/document-analysis-service';
import {
  assertGroundedExtraction,
  ExtractionGroundingError,
  parseModelExtractionOutput,
} from '@/lib/ai/extraction-schema';
import { roleHasPermission } from '@/lib/auth/permissions';
import { requestUserHasPermission } from '@/lib/auth/request-authorization';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/sessions';
import { deriveDocumentReviewStatus } from '@/lib/documents/review-status';
import {
  extractionFactKeys,
  type ModelExtractionOutput,
} from '@/types/extraction';

const ACTOR_ID = '5633fcb5-8e4a-44fb-9f32-02693e9c68a1';
const DOCUMENT_ID = '09710b43-97ec-469b-b175-03e6ef80d47b';
const CASE_ID = 'RM-PA-2001';
const SOURCE_TEXT = `SYNTHETIC DEMO DOCUMENT
Clinical Chart Notes
Patient: Demo Patient
Provider: Dr Demo
Patient may benefit from powered mobility.
No HCPCS code is present.`;

function notFoundFact() {
  return {
    value: null,
    confidence: 'LOW' as const,
    evidenceStatus: 'NOT_FOUND' as const,
    sourceQuote: null,
    uncertaintyNote: 'Information not found in the selected document.',
  };
}

function validOutput(): ModelExtractionOutput {
  const facts = Object.fromEntries(
    extractionFactKeys.map((key) => [key, notFoundFact()]),
  ) as ModelExtractionOutput['facts'];
  facts.patientName = {
    value: 'Demo Patient',
    confidence: 'HIGH',
    evidenceStatus: 'SUPPORTED',
    sourceQuote: 'Patient: Demo Patient',
    uncertaintyNote: null,
  };
  facts.requestedEquipment = {
    value: 'powered mobility',
    confidence: 'MEDIUM',
    evidenceStatus: 'NEEDS_REVIEW',
    sourceQuote: 'Patient may benefit from powered mobility.',
    uncertaintyNote:
      'This is benefit language and does not establish a physician order.',
  };
  facts.providerName = {
    value: 'Dr Demo',
    confidence: 'HIGH',
    evidenceStatus: 'SUPPORTED',
    sourceQuote: 'Provider: Dr Demo',
    uncertaintyNote: null,
  };
  return {
    classification: {
      documentType: 'Clinical Chart Notes',
      confidence: 'HIGH',
      sourceQuote: 'Clinical Chart Notes',
      needsReview: false,
    },
    warnings: ['Equipment language is ambiguous.', 'HCPCS code was not found.'],
    facts,
  };
}

class MockProvider implements DocumentAnalysisProvider {
  readonly providerName = 'mock';
  readonly modelName = 'mock-structured-model';

  constructor(private readonly output: unknown) {}

  async extract(): Promise<unknown> {
    return this.output;
  }
}

function createFixture(): {
  db: DatabaseClient;
  document: CaseDocumentRecord;
} {
  const db = createIsolatedDatabase();
  const now = new Date('2026-09-05T15:00:00.000Z');
  db.insert(users)
    .values({
      id: ACTOR_ID,
      username: 'ai.specialist',
      passwordHash: 'argon2id-test-hash',
      displayName: 'Synthetic AI Specialist',
      role: 'AUTHORIZATION_SPECIALIST',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  db.insert(priorAuthorizationCases)
    .values({
      id: CASE_ID,
      patientDisplayName: 'Synthetic Patient',
      patientInitials: 'SP',
      requestedEquipment: 'Demo device',
      equipmentCategory: 'Mobility',
      insurerName: 'Demo Plan',
      insurerPlan: 'Synthetic PPO',
      status: 'Draft',
      priority: 'Routine',
      assignedSpecialist: 'Synthetic AI Specialist',
      followUpDue: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  const document = db
    .insert(caseDocuments)
    .values({
      id: DOCUMENT_ID,
      caseId: CASE_ID,
      documentType: 'CLINICAL_CHART_NOTES',
      originalFilename: 'synthetic-chart-notes.txt',
      storedFilename: '657ec3d9-4ea4-4e58-bbb2-19c457d262e0.txt',
      mimeType: 'text/plain',
      fileSize: Buffer.byteLength(SOURCE_TEXT),
      uploadedByUserId: ACTOR_ID,
      uploadedAt: now,
      reviewStatus: 'Needs Review',
      isSynthetic: true,
    })
    .returning()
    .get();
  return { db, document };
}

void test('valid structured extraction persists grounded facts while unknown fields stay unknown', async () => {
  const { db, document } = createFixture();
  const analysis = await analyzeDocument(
    {
      caseId: CASE_ID,
      document,
      documentText: SOURCE_TEXT,
      actorUserId: ACTOR_ID,
      provider: new MockProvider(validOutput()),
    },
    db,
  );

  assert.equal(analysis.detectedDocumentType, 'Clinical Chart Notes');
  assert.equal(analysis.status, 'COMPLETED');
  assert.equal(
    analysis.facts.find((fact) => fact.fieldKey === 'dateOfBirth')
      ?.originalValue,
    null,
  );
  assert.equal(
    analysis.facts.find((fact) => fact.fieldKey === 'dateOfBirth')
      ?.reviewDecision,
    'AUTO_RESOLVED',
  );
  assert.equal(
    analysis.facts.find((fact) => fact.fieldKey === 'patientName')
      ?.reviewDecision,
    'SUGGESTED',
  );
  assert.equal(
    analysis.facts.find((fact) => fact.fieldKey === 'hcpcsCodes')
      ?.evidenceStatus,
    'NOT_FOUND',
  );
  assert.equal(
    analysis.facts.find((fact) => fact.fieldKey === 'requestedEquipment')
      ?.evidenceStatus,
    'NEEDS_REVIEW',
  );
});

void test('document review status derives from analysis facts', () => {
  const base = { id: 'a', caseId: 'c', documentId: 'd', provider: 'mock', model: 'mock', detectedDocumentType: 'Other / Unknown' as const, classificationConfidence: 'HIGH' as const, classificationSourceQuote: null, classificationNeedsReview: false, warnings: [], requestedByDisplayName: 'Reviewer', requestedAt: new Date().toISOString(), completedAt: new Date().toISOString() };
  const fact = (id: string, originalValue: string | null, evidenceStatus: 'SUPPORTED' | 'NOT_FOUND', reviewDecision: 'PENDING' | 'ACCEPTED' | 'AUTO_RESOLVED') => ({ id, fieldKey: 'patientName' as const, originalValue, confidence: 'HIGH' as const, evidenceStatus, sourceQuote: null, sourceDocumentId: 'd', uncertaintyNote: null, reviewDecision, reviewedValue: reviewDecision === 'ACCEPTED' ? originalValue : null, reviewerDisplayName: null, reviewedAt: null });
  assert.equal(deriveDocumentReviewStatus([{ ...base, status: 'COMPLETED', facts: [fact('1', 'Value', 'SUPPORTED', 'PENDING')] }]), 'Needs Review');
  assert.equal(deriveDocumentReviewStatus([{ ...base, status: 'COMPLETED', facts: [fact('1', null, 'NOT_FOUND', 'AUTO_RESOLVED')] }]), 'NO_ACTION_NEEDED');
  assert.equal(deriveDocumentReviewStatus([{ ...base, status: 'COMPLETED', facts: [fact('1', 'Value', 'SUPPORTED', 'ACCEPTED')] }]), 'REVIEW_COMPLETE');
  assert.equal(deriveDocumentReviewStatus([{ ...base, status: 'FAILED', facts: [] }]), 'ANALYSIS_FAILED');
});

void test('an unsupported HCPCS code cannot be invented outside its evidence quote', () => {
  const output = validOutput();
  output.facts.hcpcsCodes = {
    value: 'E1234',
    confidence: 'HIGH',
    evidenceStatus: 'SUPPORTED',
    sourceQuote: 'No HCPCS code is present.',
    uncertaintyNote: null,
  };
  assert.throws(
    () => assertGroundedExtraction(output, SOURCE_TEXT),
    ExtractionGroundingError,
  );
});

void test('low-confidence classification may remain Other / Unknown', () => {
  const output = validOutput();
  output.classification = {
    documentType: 'Other / Unknown',
    confidence: 'LOW',
    sourceQuote: null,
    needsReview: true,
  };
  assert.doesNotThrow(() => assertGroundedExtraction(output, SOURCE_TEXT));
});

void test('malformed model output is rejected safely and persisted as failed', async () => {
  const { db, document } = createFixture();
  await assert.rejects(
    () =>
      analyzeDocument(
        {
          caseId: CASE_ID,
          document,
          documentText: SOURCE_TEXT,
          actorUserId: ACTOR_ID,
          provider: new MockProvider({ malformed: true }),
        },
        db,
      ),
    (error: unknown) =>
      error instanceof DocumentAnalysisServiceError &&
      error.code === 'INVALID_MODEL_OUTPUT',
  );
  assert.equal(db.select().from(documentAnalyses).get()?.status, 'FAILED');
  assert.throws(() => parseModelExtractionOutput({ malformed: true }));
});

void test('human decisions remain separate and audit events omit document contents', async () => {
  const { db, document } = createFixture();
  const analysis = await analyzeDocument(
    {
      caseId: CASE_ID,
      document,
      documentText: SOURCE_TEXT,
      actorUserId: ACTOR_ID,
      provider: new MockProvider(validOutput()),
    },
    db,
  );
  const patientName = analysis.facts.find(
    (fact) => fact.fieldKey === 'patientName',
  )!;
  const equipment = analysis.facts.find(
    (fact) => fact.fieldKey === 'requestedEquipment',
  )!;
  const providerName = analysis.facts.find(
    (fact) => fact.fieldKey === 'providerName',
  )!;
  const dateOfBirth = analysis.facts.find(
    (fact) => fact.fieldKey === 'dateOfBirth',
  )!;

  reviewFact(
    {
      caseId: CASE_ID,
      documentId: DOCUMENT_ID,
      analysisId: analysis.id,
      factId: patientName.id,
      decision: 'ACCEPTED',
      actorUserId: ACTOR_ID,
    },
    db,
  );
  assert.throws(
    () =>
      reviewFact(
        {
          caseId: CASE_ID,
          documentId: DOCUMENT_ID,
          analysisId: analysis.id,
          factId: dateOfBirth.id,
          decision: 'REJECTED',
          actorUserId: ACTOR_ID,
        },
        db,
      ),
    (error: unknown) =>
      error instanceof DocumentAnalysisServiceError &&
      error.code === 'INVALID_REVIEW',
  );
  reviewFact(
    {
      caseId: CASE_ID,
      documentId: DOCUMENT_ID,
      analysisId: analysis.id,
      factId: dateOfBirth.id,
      decision: 'EDITED',
      reviewedValue: 'Reviewer-entered synthetic value',
      actorUserId: ACTOR_ID,
    },
    db,
  );
  reviewFact(
    {
      caseId: CASE_ID,
      documentId: DOCUMENT_ID,
      analysisId: analysis.id,
      factId: equipment.id,
      decision: 'EDITED',
      reviewedValue: 'Reviewer-confirmed mobility equipment',
      actorUserId: ACTOR_ID,
    },
    db,
  );
  reviewFact(
    {
      caseId: CASE_ID,
      documentId: DOCUMENT_ID,
      analysisId: analysis.id,
      factId: providerName.id,
      decision: 'REJECTED',
      actorUserId: ACTOR_ID,
    },
    db,
  );

  const saved = getDocumentAnalysis(CASE_ID, DOCUMENT_ID, analysis.id, db)!;
  assert.equal(
    saved.facts.find((fact) => fact.id === equipment.id)?.originalValue,
    'powered mobility',
  );
  assert.equal(
    saved.facts.find((fact) => fact.id === equipment.id)?.reviewedValue,
    'Reviewer-confirmed mobility equipment',
  );

  const events = db.select().from(auditEvents).all();
  assert.deepEqual(
    events.map((event) => event.action),
    [
      'document.analysis_requested',
      'document.analysis_completed',
      'extracted_fact.accepted',
      'extracted_fact.edited',
      'extracted_fact.edited',
      'extracted_fact.rejected',
    ],
  );
  assert.equal(JSON.stringify(events).includes('powered mobility'), false);
  assert.equal(JSON.stringify(events).includes('Demo Patient'), false);
});

void test('unauthenticated users and auditors fail the server guard used by analysis and review routes', () => {
  const db = createIsolatedDatabase();
  const now = new Date();
  db.insert(users)
    .values({
      id: '138ca787-2562-4444-8c72-1750fc6db1fd',
      username: 'audit.reader',
      passwordHash: 'argon2id-test-hash',
      displayName: 'Synthetic Auditor',
      role: 'AUDITOR',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  const session = createSession('138ca787-2562-4444-8c72-1750fc6db1fd', db);
  const unauthenticated = new NextRequest('http://localhost/api/analysis', {
    method: 'POST',
  });
  const auditorRequest = new NextRequest('http://localhost/api/analysis', {
    method: 'POST',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${session.token}`,
      origin: 'http://localhost',
    },
  });

  assert.equal(
    requestUserHasPermission(unauthenticated, 'cases.write', db),
    null,
  );
  assert.equal(
    requestUserHasPermission(auditorRequest, 'cases.write', db),
    null,
  );
  assert.equal(roleHasPermission('AUDITOR', 'cases.write'), false);
  assert.equal(
    roleHasPermission('AUTHORIZATION_SPECIALIST', 'cases.write'),
    true,
  );
});
