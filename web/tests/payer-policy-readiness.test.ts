import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';

import { createIsolatedDatabase, type DatabaseClient } from '@/db/client';
import { auditEvents, priorAuthorizationCases, users } from '@/db/schema';
import { getPolicy, savePolicy } from '@/db/repositories/policies';
import { roleHasPermission } from '@/lib/auth/permissions';
import { requestUserHasPermission } from '@/lib/auth/request-authorization';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth/sessions';
import { matchPayerPolicy } from '@/lib/policies/match-policy';
import { evaluatePolicyRequirements } from '@/lib/policies/readiness-engine';
import { generateReadiness } from '@/lib/policies/readiness-service';
import type { CaseDocument, PriorAuthorizationCase } from '@/types/case';
import type { PriorAuthDraft, PriorAuthDraftField } from '@/types/prior-auth-draft';
import type { PayerPolicy, PolicyRequirement } from '@/types/policy';

const CASE_ID = 'RM-PA-1099';
const USER_ID = '30000000-0000-4000-8000-000000000001';

function caseData(): PriorAuthorizationCase {
  return {
    id: CASE_ID,
    patientName: 'Synthetic Patient',
    patientInitials: 'SP',
    requestedEquipment: 'Power mobility device',
    equipmentCategory: 'Mobility',
    insurer: 'Meridian Demo Health',
    insurerPlan: 'Power Mobility Plan',
    status: 'Draft',
    priority: 'Routine',
    assignedSpecialist: 'Synthetic Specialist',
    followUpDue: null,
    followUpLabel: '—',
    isFollowUpDue: false,
    missingDocumentationCount: 0,
    createdAt: '2026-09-05T15:00:00.000Z',
    updatedAt: '2026-09-05T15:00:00.000Z',
    lastUpdated: '1 min ago',
  };
}

function field(
  key: string,
  value: string | null,
  status: PriorAuthDraftField['status'],
  sourceDocumentIds: string[] = [],
): PriorAuthDraftField {
  return {
    id: `field-${key}`,
    fieldKey: key as PriorAuthDraftField['fieldKey'],
    status,
    aiProposedValue: value,
    humanVerifiedValue: status === 'VERIFIED' ? value : null,
    displayValue: value,
    editedByDisplayName: status === 'VERIFIED' ? 'Synthetic Specialist' : null,
    editedAt: status === 'VERIFIED' ? '2026-09-05T15:00:00.000Z' : null,
    sources: sourceDocumentIds.map((documentId) => ({
      extractedFactId: `fact-${key}-${documentId}`,
      documentId,
      documentFilename: `${documentId}.txt`,
      documentType: 'Clinical Chart Notes',
      value: value ?? '',
      confidence: 'HIGH',
      evidenceStatus: 'SUPPORTED',
      sourceQuote: value ?? '',
      valueOrigin: status === 'VERIFIED' ? 'HUMAN_VERIFIED' : 'AI_POPULATED',
    })),
  };
}

function draft(fields: PriorAuthDraftField[]): PriorAuthDraft {
  return {
    id: 'draft-1',
    caseId: CASE_ID,
    revision: 1,
    generatedByDisplayName: 'Synthetic Specialist',
    generatedAt: '2026-09-05T15:00:00.000Z',
    updatedAt: '2026-09-05T15:00:00.000Z',
    fields,
    notes: {
      keySupportingEvidence: [],
      missingInformation: [],
      conflictingInformation: [],
      areasRequiringReview: [],
    },
  };
}

function requirement(overrides: Partial<PolicyRequirement>): PolicyRequirement {
  return {
    id: overrides.id ?? `req-${Math.random()}`,
    policyId: 'policy-1',
    requirementKey: overrides.requirementKey ?? 'required-field',
    label: overrides.label ?? 'Requested equipment',
    kind: overrides.kind ?? 'FIELD',
    documentType: overrides.documentType ?? null,
    fieldKey: overrides.fieldKey ?? 'requestedEquipment',
    conditionType: overrides.conditionType ?? 'ALWAYS',
    conditionValue: overrides.conditionValue ?? null,
    requirementLevel: 'REQUIRED',
    explanation: overrides.explanation ?? 'Configured synthetic requirement.',
    blocksReadiness: overrides.blocksReadiness ?? true,
    sortOrder: overrides.sortOrder ?? 0,
  };
}

function policy(overrides: Partial<PayerPolicy> = {}): PayerPolicy {
  return {
    id: overrides.id ?? 'policy-1',
    payerId: 'payer-1',
    payerName: 'Meridian Demo Health',
    planName: 'Power Mobility Plan',
    policyName: 'Power Mobility Documentation Policy',
    equipmentCategory: 'Mobility',
    hcpcsCodes: [],
    effectiveDate: '2026-01-01',
    expirationDate: null,
    submissionChannel: 'Synthetic review queue',
    followUpIntervalDays: 5,
    sourceType: 'SYNTHETIC_DEMONSTRATION',
    sourceReference: 'Synthetic policy source',
    notes: 'Synthetic only.',
    version: 'v1',
    isSynthetic: true,
    isActive: true,
    requirements: [requirement({ id: 'req-equipment' })],
    ...overrides,
  };
}

function document(id: string, type: CaseDocument['documentType'], reviewStatus: CaseDocument['reviewStatus'] = 'Reviewed'): CaseDocument {
  return {
    id,
    caseId: CASE_ID,
    documentType: type,
    originalFilename: `${id}.txt`,
    mimeType: 'text/plain',
    fileSize: 100,
    uploadedByDisplayName: 'Synthetic Specialist',
    uploadedAt: '2026-09-05T15:00:00.000Z',
    reviewStatus,
    isSynthetic: true,
    analyses: [],
  };
}

void test('policy matching is deterministic and requires verified HCPCS data when configured', () => {
  const matched = matchPayerPolicy({ caseData: caseData(), draft: draft([field('requestedEquipment', 'Power mobility device', 'VERIFIED')]), policies: [policy()] , asOf: '2026-09-05' });
  assert.equal(matched.status, 'MATCHED');
  assert.equal(matched.policy?.version, 'v1');

  const noMatch = matchPayerPolicy({ caseData: { ...caseData(), insurer: 'Unknown Demo Payer' }, draft: null, policies: [policy()], asOf: '2026-09-05' });
  assert.equal(noMatch.status, 'NO_MATCH');

  const ambiguous = matchPayerPolicy({ caseData: caseData(), draft: null, policies: [policy(), policy({ id: 'policy-2', version: 'v2' })], asOf: '2026-09-05' });
  assert.equal(ambiguous.status, 'AMBIGUOUS');

  const codePolicy = policy({ hcpcsCodes: ['E1234'] });
  const insufficient = matchPayerPolicy({ caseData: caseData(), draft: null, policies: [codePolicy], asOf: '2026-09-05' });
  assert.equal(insufficient.status, 'INSUFFICIENT_DATA');
  const codeMatched = matchPayerPolicy({ caseData: caseData(), draft: draft([field('hcpcsCodes', 'E1234', 'VERIFIED')]), policies: [codePolicy], asOf: '2026-09-05' });
  assert.equal(codeMatched.status, 'MATCHED');
});

void test('readiness engine evaluates present, missing, conflict, and not-applicable requirements without model input', () => {
  const evaluated = evaluatePolicyRequirements({
    caseData: caseData(),
    draft: draft([
      field('requestedEquipment', 'Power mobility device', 'VERIFIED', ['order-1']),
      field('orderingProvider', 'Dr Synthetic', 'CONFLICT', ['order-1', 'notes-1']),
    ]),
    documents: [document('order-1', 'PHYSICIAN_ORDER')],
    policy: policy({
      requirements: [
        requirement({ id: 'req-doc', requirementKey: 'order', label: 'Physician order', kind: 'DOCUMENT', documentType: 'PHYSICIAN_ORDER', fieldKey: null }),
        requirement({ id: 'req-present', requirementKey: 'equipment', label: 'Requested equipment' }),
        requirement({ id: 'req-conflict', requirementKey: 'provider', label: 'Ordering provider', fieldKey: 'orderingProvider' }),
        requirement({ id: 'req-na', requirementKey: 'accessory', label: 'Accessory justification', fieldKey: 'requestedAccessories', conditionType: 'EQUIPMENT_CONTAINS', conditionValue: 'accessory' }),
      ],
    }),
    policyMatchStatus: 'MATCHED',
  });
  assert.equal(evaluated.status, 'CONFLICT_DETECTED');
  assert.equal(evaluated.satisfiedCount, 2);
  assert.equal(evaluated.applicableCount, 3);
  assert.equal(evaluated.requirements.find((item) => item.requirementKey === 'order')?.status, 'PRESENT');
  assert.equal(evaluated.requirements.find((item) => item.requirementKey === 'provider')?.status, 'CONFLICT');
  assert.equal(evaluated.requirements.find((item) => item.requirementKey === 'accessory')?.status, 'NOT_APPLICABLE');

  const modelLikeUnverified = evaluatePolicyRequirements({
    caseData: caseData(),
    draft: draft([field('requestedEquipment', 'Power mobility device', 'AUTO_POPULATED', ['ai-source'])]),
    documents: [],
    policy: policy(),
    policyMatchStatus: 'MATCHED',
  });
  assert.equal(modelLikeUnverified.status, 'NEEDS_HUMAN_REVIEW');
});

void test('verified canonical provider and equipment fields satisfy readiness with truthful explanations', () => {
  const evaluated = evaluatePolicyRequirements({
    caseData: caseData(),
    draft: draft([
      field('orderingProvider', 'Dr. Taylor Morgan', 'VERIFIED', ['order-1']),
      field('requestedEquipment', 'Custom power mobility device', 'VERIFIED', ['order-1']),
    ]),
    documents: [],
    policy: policy({ requirements: [
      requirement({ requirementKey: 'provider', label: 'Ordering provider', fieldKey: 'orderingProvider' }),
      requirement({ requirementKey: 'equipment', label: 'Requested equipment', fieldKey: 'requestedEquipment' }),
    ] }),
    policyMatchStatus: 'MATCHED',
  });
  assert.equal(evaluated.requirements.every((item) => item.status === 'PRESENT'), true);
  assert.match(evaluated.requirements[0]!.reason, /Human-verified/i);
  assert.doesNotMatch(evaluated.requirements[0]!.reason, /not yet verified/i);
});

void test('trusted case values satisfy readiness when no human extraction exists', () => {
  const evaluated = evaluatePolicyRequirements({
    caseData: caseData(),
    draft: draft([field('requestedEquipment', 'Power mobility device', 'AUTO_POPULATED')]),
    documents: [],
    policy: policy({ requirements: [requirement({ fieldKey: 'requestedEquipment' })] }),
    policyMatchStatus: 'MATCHED',
  });
  assert.equal(evaluated.requirements[0]!.status, 'PRESENT');
  assert.match(evaluated.requirements[0]!.reason, /Trusted case-record/i);
});

void test('complete verified case reaches specialist review without approval language', () => {
  const evaluated = evaluatePolicyRequirements({
    caseData: caseData(),
    draft: draft([field('requestedEquipment', 'Power mobility device', 'VERIFIED')]),
    documents: [],
    policy: policy(),
    policyMatchStatus: 'MATCHED',
  });
  assert.equal(evaluated.status, 'READY_FOR_SPECIALIST_REVIEW');
  assert.match(evaluated.nextBestAction, /specialist review/i);
  assert.doesNotMatch(evaluated.nextBestAction, /approved|covered|eligible|medical necessity/i);
});

void test('policy persistence exposes version and effective date', () => {
  const db = createIsolatedDatabase();
  const saved = savePolicy({
    payerName: 'Synthetic Payer',
    planName: 'Synthetic Plan',
    policyName: 'Synthetic Policy',
    equipmentCategory: 'Mobility',
    hcpcsCodes: [],
    effectiveDate: '2026-02-01',
    expirationDate: null,
    submissionChannel: 'Synthetic channel',
    followUpIntervalDays: 5,
    sourceType: 'SYNTHETIC_DEMONSTRATION',
    sourceReference: 'Synthetic citation',
    notes: 'Synthetic',
    version: 'v7',
    isActive: true,
    requirements: [
      { requirementKey: 'equipment', label: 'Equipment', kind: 'FIELD', documentType: null, fieldKey: 'requestedEquipment', conditionType: 'ALWAYS', conditionValue: null, requirementLevel: 'REQUIRED', explanation: 'Synthetic requirement', blocksReadiness: true, sortOrder: 0 },
    ],
  }, db);
  const loaded = getPolicy(saved.id, db)!;
  assert.equal(loaded.version, 'v7');
  assert.equal(loaded.effectiveDate, '2026-02-01');
  assert.equal(loaded.requirements[0]?.explanation, 'Synthetic requirement');
});

function readinessFixture(): DatabaseClient {
  const db = createIsolatedDatabase();
  const now = new Date('2026-09-05T15:00:00.000Z');
  db.insert(users).values({ id: USER_ID, username: 'policy.specialist', passwordHash: 'argon2id-test', displayName: 'Synthetic Specialist', role: 'AUTHORIZATION_SPECIALIST', isActive: true, createdAt: now, updatedAt: now }).run();
  db.insert(priorAuthorizationCases).values({ id: CASE_ID, patientDisplayName: 'Synthetic Patient', patientInitials: 'SP', requestedEquipment: 'Power mobility device', equipmentCategory: 'Mobility', insurerName: 'Synthetic Payer', insurerPlan: 'Synthetic Plan', status: 'Draft', priority: 'Routine', assignedSpecialist: 'Synthetic Specialist', followUpDue: null, createdAt: now, updatedAt: now }).run();
  return db;
}

void test('specialists cannot modify policies and readiness audit contains no clinical text', () => {
  assert.equal(roleHasPermission('AUTHORIZATION_SPECIALIST', 'policies.manage'), false);
  assert.equal(roleHasPermission('ADMIN', 'policies.manage'), true);
  const db = readinessFixture();
  const session = createSession(USER_ID, db);
  const request = new NextRequest('http://localhost/api/admin/policies', { method: 'POST', headers: { cookie: `${SESSION_COOKIE_NAME}=${session.token}`, origin: 'http://localhost' } });
  assert.equal(requestUserHasPermission(request, 'policies.manage', db), null);
  assert.equal(JSON.stringify(db.select().from(auditEvents).all()).includes('Synthetic Patient'), false);
});

void test('manual policy selection and readiness evaluation are audited without clinical content', () => {
  const db = readinessFixture();
  const saved = savePolicy({
    payerName: 'Synthetic Payer',
    planName: 'Synthetic Plan',
    policyName: 'Synthetic Readiness Policy',
    equipmentCategory: 'Mobility',
    hcpcsCodes: [],
    effectiveDate: '2026-01-01',
    expirationDate: null,
    submissionChannel: 'Synthetic channel',
    followUpIntervalDays: 5,
    sourceType: 'SYNTHETIC_DEMONSTRATION',
    sourceReference: 'Synthetic citation',
    notes: 'Synthetic',
    version: 'v1',
    isActive: true,
    requirements: [
      { requirementKey: 'equipment', label: 'Equipment', kind: 'FIELD', documentType: null, fieldKey: 'requestedEquipment', conditionType: 'ALWAYS', conditionValue: null, requirementLevel: 'REQUIRED', explanation: 'Synthetic requirement', blocksReadiness: true, sortOrder: 0 },
    ],
  }, db);
  const evaluation = generateReadiness({
    caseDetail: { ...caseData(), checklist: [], documents: [], notes: [], priorAuthDraft: draft([field('requestedEquipment', 'Power mobility device', 'VERIFIED')]), readiness: null },
    actorUserId: USER_ID,
    manualPolicyId: saved.id,
  }, db);
  assert.equal(evaluation.selectionType, 'MANUAL');
  assert.equal(evaluation.status, 'READY_FOR_SPECIALIST_REVIEW');
  const actions = db.select().from(auditEvents).all().map((event) => event.action);
  assert.deepEqual(actions, ['case.policy_manually_selected', 'case.readiness_evaluated']);
  assert.equal(JSON.stringify(db.select().from(auditEvents).all()).includes('Power mobility device'), false);
});
