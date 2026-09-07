import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSubmissionPacket } from '@/lib/submissions/build-submission-packet';
import { createIsolatedDatabase } from '@/db/client';
import { auditEvents, priorAuthorizationCases, users } from '@/db/schema';
import { deleteCommunicationDraft, generateCommunication } from '@/lib/communications/communication-service';
import { roleHasPermission } from '@/lib/auth/permissions';
import { createCommunication, listCommunications, updateCommunication } from '@/db/repositories/communications';
import { zodTextFormat } from 'openai/helpers/zod';
import { communicationDraftSchema } from '@/lib/ai/communication-draft-schema';

void test('submission packet uses only verified fields and preserves readiness warnings', () => {
  const packet = buildSubmissionPacket({
    id: 'case-1', patientName: 'Synthetic Patient', patientInitials: 'SP', requestedEquipment: 'Power wheelchair', equipmentCategory: 'POWER_MOBILITY', insurer: 'Meridian Demo Health', insurerPlan: 'Demo Plan', status: 'Draft', priority: 'Routine', assignedSpecialist: 'Synthetic Specialist', followUpDue: null, followUpLabel: '—', isFollowUpDue: false, missingDocumentationCount: 1, createdAt: '', updatedAt: '', lastUpdated: '', checklist: [], documents: [], notes: [],
    priorAuthDraft: { id:'d',caseId:'case-1',revision:1,generatedByDisplayName:null,generatedAt:'',updatedAt:'',fields:[{id:'f',fieldKey:'requestedEquipment',status:'VERIFIED',aiProposedValue:'Power wheelchair',humanVerifiedValue:'Power wheelchair',displayValue:'Power wheelchair',editedByDisplayName:null,editedAt:null,sources:[]}],notes:{keySupportingEvidence:[],missingInformation:[],conflictingInformation:[],areasRequiringReview:[]}}, readiness: null,
  });
  assert.equal(packet.request.equipment, 'Power wheelchair');
  assert.deepEqual(packet.unresolvedItems, ['Readiness evaluation has not been run.']);
  assert.equal(packet.readyForPreparation, false);
});

void test('all six communication types persist generated drafts and audit without bodies', async () => {
  const db = createIsolatedDatabase();
  const now = new Date('2026-09-06T12:00:00.000Z');
  const userId = '50000000-0000-4000-8000-000000000001';
  db.insert(users).values({ id: userId, username: 'comms.specialist', passwordHash: 'test', displayName: 'Synthetic Specialist', role: 'AUTHORIZATION_SPECIALIST', isActive: true, createdAt: now, updatedAt: now }).run();
  db.insert(priorAuthorizationCases).values({ id: 'RM-COMMS-1', patientDisplayName: 'Synthetic Patient', patientInitials: 'SP', requestedEquipment: 'Power wheelchair', equipmentCategory: 'Mobility', insurerName: 'Synthetic Payer', insurerPlan: 'Synthetic Plan', status: 'Draft', priority: 'Routine', assignedSpecialist: 'Synthetic Specialist', followUpDue: null, createdAt: now, updatedAt: now }).run();
  const detail = { id: 'RM-COMMS-1', patientName: 'Synthetic Patient', patientInitials: 'SP', requestedEquipment: 'Power wheelchair', equipmentCategory: 'Mobility', insurer: 'Synthetic Payer', insurerPlan: 'Synthetic Plan', status: 'Draft', priority: 'Routine', assignedSpecialist: 'Synthetic Specialist', followUpDue: null, followUpLabel: '—', isFollowUpDue: false, missingDocumentationCount: 0, createdAt: now.toISOString(), updatedAt: now.toISOString(), lastUpdated: 'now', checklist: [], documents: [], notes: [], priorAuthDraft: null, readiness: null, submission: null, communications: [], submissionPacket: null, appeal: null } as never;
  const provider = { providerName: 'mock', modelName: 'mock', async generate(input: { type: string }) { return { subject: input.type, body: `Synthetic ${input.type} body`, notes: [] }; } };
  const cases = [
    ['AUTHORIZATION_REQUEST', 'EMAIL'],
    ['INITIAL_SUBMISSION_EMAIL', 'EMAIL'],
    ['FOLLOW_UP_EMAIL', 'EMAIL'],
    ['FAX_COVER', 'FAX'],
    ['PHONE_SCRIPT', 'PHONE'],
    ['ADDITIONAL_INFO_RESPONSE', 'EMAIL'],
  ] as const;
  for (const [type, channel] of cases) {
    const row = await generateCommunication({ caseDetail: detail, type, channel, purpose: type, userId, provider }, db);
    assert.equal(row.status, 'DRAFT');
    assert.equal(row.type, type);
    assert.equal(row.channel, channel);
  }
  assert.equal(db.select().from(priorAuthorizationCases).all().length, 1);
  assert.equal(db.select().from(auditEvents).all().length, 6);
  assert.equal(JSON.stringify(db.select().from(auditEvents).all()).includes('Synthetic AUTHORIZATION_REQUEST body'), false);
});

void test('communication generation permission is not granted to auditors', () => {
  assert.equal(roleHasPermission('AUTHORIZATION_SPECIALIST', 'communications.generate'), true);
  assert.equal(roleHasPermission('ADMIN', 'communications.generate'), true);
  assert.equal(roleHasPermission('AUDITOR', 'communications.generate'), false);
});

void test('draft deletion removes only deletable communications and audits without body content', () => {
  const db = createIsolatedDatabase();
  const now = new Date('2026-09-06T12:00:00.000Z');
  const userId = '50000000-0000-4000-8000-000000000003';
  db.insert(users).values({ id: userId, username: 'comms.delete', passwordHash: 'test', displayName: 'Synthetic Specialist', role: 'AUTHORIZATION_SPECIALIST', isActive: true, createdAt: now, updatedAt: now }).run();
  db.insert(priorAuthorizationCases).values({ id: 'RM-COMMS-DELETE', patientDisplayName: 'Synthetic Patient', patientInitials: 'SP', requestedEquipment: 'Power wheelchair', equipmentCategory: 'Mobility', insurerName: 'Synthetic Payer', insurerPlan: 'Synthetic Plan', status: 'Draft', priority: 'Routine', assignedSpecialist: 'Synthetic Specialist', followUpDue: null, createdAt: now, updatedAt: now }).run();
  const draft = createCommunication({ caseId: 'RM-COMMS-DELETE', type: 'PHONE_SCRIPT', channel: 'PHONE', purpose: 'Phone script', generatedContent: { body: 'Synthetic body' }, userId }, db);
  const used = createCommunication({ caseId: 'RM-COMMS-DELETE', type: 'FAX_COVER', channel: 'FAX', purpose: 'Fax cover', generatedContent: { body: 'Finalized synthetic body' }, userId }, db);
  updateCommunication(used.id, { status: 'USED' }, db);
  assert.equal(listCommunications('RM-COMMS-DELETE', db).length, 2);
  assert.equal(deleteCommunicationDraft({ caseId: 'RM-COMMS-DELETE', communicationId: draft.id, userId }, db), true);
  assert.equal(deleteCommunicationDraft({ caseId: 'RM-COMMS-DELETE', communicationId: used.id, userId }, db), false);
  assert.equal(listCommunications('RM-COMMS-DELETE', db).some((item) => item.id === draft.id), false);
  assert.equal(JSON.stringify(db.select().from(auditEvents).all()).includes('Synthetic body'), false);
});

void test('failed communication generation does not persist a draft', async () => {
  const db = createIsolatedDatabase();
  const now = new Date();
  const userId = '50000000-0000-4000-8000-000000000002';
  db.insert(users).values({ id: userId, username: 'comms.failure', passwordHash: 'test', displayName: 'Synthetic Specialist', role: 'AUTHORIZATION_SPECIALIST', isActive: true, createdAt: now, updatedAt: now }).run();
  db.insert(priorAuthorizationCases).values({ id: 'RM-COMMS-2', patientDisplayName: 'Synthetic Patient', patientInitials: 'SP', requestedEquipment: 'Power wheelchair', equipmentCategory: 'Mobility', insurerName: 'Synthetic Payer', insurerPlan: 'Synthetic Plan', status: 'Draft', priority: 'Routine', assignedSpecialist: 'Synthetic Specialist', followUpDue: null, createdAt: now, updatedAt: now }).run();
  const provider = { providerName: 'mock', modelName: 'mock', async generate() { throw new Error('mock model failure'); } };
  const detail = { id: 'RM-COMMS-2', patientName: 'Synthetic Patient', patientInitials: 'SP', requestedEquipment: 'Power wheelchair', equipmentCategory: 'Mobility', insurer: 'Synthetic Payer', insurerPlan: 'Synthetic Plan', status: 'Draft', priority: 'Routine', assignedSpecialist: 'Synthetic Specialist', followUpDue: null, followUpLabel: '—', isFollowUpDue: false, missingDocumentationCount: 0, createdAt: now.toISOString(), updatedAt: now.toISOString(), lastUpdated: 'now', checklist: [], documents: [], notes: [], priorAuthDraft: null, readiness: null, submission: null, communications: [], submissionPacket: null, appeal: null } as never;
  await assert.rejects(() => generateCommunication({ caseDetail: detail, type: 'PHONE_SCRIPT', channel: 'PHONE', purpose: 'Phone script', userId, provider }, db), /mock model failure/);
  assert.equal(db.select().from(auditEvents).all().length, 0);
});

void test('communication structured-output schema is JSON-Schema compatible', () => {
  assert.doesNotThrow(() => zodTextFormat(communicationDraftSchema, 'prior_authorization_communication_draft'));
});
