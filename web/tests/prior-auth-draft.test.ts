import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createIsolatedDatabase, type DatabaseClient } from '@/db/client';
import {
  auditEvents,
  caseDocuments,
  documentAnalyses,
  extractedFacts,
  priorAuthorizationCases,
  users,
} from '@/db/schema';
import type { CaseDraftSummaryProvider } from '@/lib/ai/case-draft-summary-provider';
import { aggregateCaseDocuments } from '@/lib/drafts/aggregate-draft';
import {
  generatePriorAuthDraft,
  saveVerifiedDraftValue,
} from '@/lib/drafts/prior-auth-draft-service';
import { selectConflictCandidate } from '@/lib/drafts/conflict-selection';
import type { CaseDocument } from '@/types/case';
import type {
  DocumentAnalysis,
  ExtractedFact,
  ExtractionFactKey,
} from '@/types/extraction';
import type { DraftSummaryProviderInput } from '@/types/prior-auth-draft';

const CASE_ID = 'RM-PA-DRAFT-1';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-09-05T16:00:00.000Z');

void test('conflict candidate selection only populates the local value and never persists by itself', () => {
  const selection = selectConflictCandidate('cannot safely complete household mobility with a cane or walker');
  assert.equal(selection.value, 'cannot safely complete household mobility with a cane or walker');
  assert.equal(selection.persist, false);
});

class GroundedSummaryProvider implements CaseDraftSummaryProvider {
  readonly providerName = 'mock';
  readonly modelName = 'mock-grounded-summary';

  async summarize(input: DraftSummaryProviderInput): Promise<unknown> {
    const patient = input.fields.find((field) => field.fieldKey === 'patientName');
    return {
      keySupportingEvidence: patient?.candidates[0]
        ? [
            {
              text: 'The analyzed documents explicitly identify the synthetic patient.',
              fieldKeys: ['patientName'],
              sourceFactIds: [patient.candidates[0].extractedFactId],
            },
          ]
        : [],
      missingInformation: [],
      conflictingInformation: [],
      areasRequiringReview: [],
    };
  }
}

function fact(
  id: string,
  documentId: string,
  fieldKey: ExtractionFactKey,
  value: string,
  quote: string,
  confidence: 'HIGH' | 'MEDIUM' = 'HIGH',
): ExtractedFact {
  return {
    id,
    fieldKey,
    originalValue: value,
    confidence,
    evidenceStatus: confidence === 'HIGH' ? 'SUPPORTED' : 'NEEDS_REVIEW',
    sourceQuote: quote,
    sourceDocumentId: documentId,
    uncertaintyNote: confidence === 'HIGH' ? null : 'Specialist review is required.',
    reviewDecision: confidence === 'HIGH' ? 'SUGGESTED' : 'PENDING',
    reviewedValue: null,
    reviewerDisplayName: null,
    reviewedAt: null,
  };
}

function analysis(
  id: string,
  documentId: string,
  facts: ExtractedFact[],
): DocumentAnalysis {
  return {
    id,
    caseId: CASE_ID,
    documentId,
    status: 'COMPLETED',
    provider: 'mock',
    model: 'mock-extractor',
    detectedDocumentType: 'Clinical Chart Notes',
    classificationConfidence: 'HIGH',
    classificationSourceQuote: 'Clinical Chart Notes',
    classificationNeedsReview: false,
    warnings: [],
    requestedByDisplayName: 'Synthetic Specialist',
    requestedAt: NOW.toISOString(),
    completedAt: NOW.toISOString(),
    facts,
  };
}

function document(
  id: string,
  filename: string,
  documentAnalysis: DocumentAnalysis,
): CaseDocument {
  return {
    id,
    caseId: CASE_ID,
    documentType: 'CLINICAL_CHART_NOTES',
    originalFilename: filename,
    mimeType: 'text/plain',
    fileSize: 128,
    uploadedByDisplayName: 'Synthetic Specialist',
    uploadedAt: NOW.toISOString(),
    reviewStatus: 'Needs Review',
    isSynthetic: true,
    analyses: [documentAnalysis],
  };
}

function createDocuments(): CaseDocument[] {
  const firstId = 'doc-a';
  const secondId = 'doc-b';
  return [
    document(
      firstId,
      'synthetic-chart-a.txt',
      analysis('analysis-a', firstId, [
        fact('10000000-0000-4000-8000-000000000001', firstId, 'patientName', 'Demo Patient', 'Patient: Demo Patient'),
        fact('10000000-0000-4000-8000-000000000002', firstId, 'dateOfBirth', '04/12/1970', 'DOB: 04/12/1970'),
        fact(
          '10000000-0000-4000-8000-000000000003',
          firstId,
          'requestedEquipment',
          'powered mobility',
          'Patient may benefit from powered mobility.',
          'MEDIUM',
        ),
      ]),
    ),
    document(
      secondId,
      'synthetic-chart-b.txt',
      analysis('analysis-b', secondId, [
        fact('10000000-0000-4000-8000-000000000004', secondId, 'patientName', 'Demo Patient', 'Patient: Demo Patient'),
        fact('10000000-0000-4000-8000-000000000005', secondId, 'dateOfBirth', '04/21/1970', 'DOB: 04/21/1970'),
      ]),
    ),
  ];
}

function createFixture(documents: CaseDocument[]): DatabaseClient {
  const db = createIsolatedDatabase();
  db.insert(users)
    .values({
      id: USER_ID,
      username: 'draft.specialist',
      passwordHash: 'argon2id-test-hash',
      displayName: 'Synthetic Specialist',
      role: 'AUTHORIZATION_SPECIALIST',
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW,
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
      assignedSpecialist: 'Synthetic Specialist',
      followUpDue: null,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();

  for (const item of documents) {
    db.insert(caseDocuments)
      .values({
        id: item.id,
        caseId: CASE_ID,
        documentType: item.documentType,
        originalFilename: item.originalFilename,
        storedFilename: `${item.id}.txt`,
        mimeType: item.mimeType,
        fileSize: item.fileSize,
        uploadedByUserId: USER_ID,
        uploadedAt: NOW,
        reviewStatus: item.reviewStatus,
        isSynthetic: true,
      })
      .run();
    const currentAnalysis = item.analyses[0]!;
    db.insert(documentAnalyses)
      .values({
        id: currentAnalysis.id,
        caseId: CASE_ID,
        documentId: item.id,
        requestedByUserId: USER_ID,
        status: 'COMPLETED',
        provider: 'mock',
        model: 'mock-extractor',
        detectedDocumentType: currentAnalysis.detectedDocumentType,
        classificationConfidence: 'HIGH',
        classificationSourceQuote: 'Clinical Chart Notes',
        classificationNeedsReview: false,
        warningsJson: '[]',
        requestedAt: NOW,
        completedAt: NOW,
      })
      .run();
    db.insert(extractedFacts)
      .values(
        currentAnalysis.facts.map((itemFact) => ({
          id: itemFact.id,
          analysisId: currentAnalysis.id,
          fieldKey: itemFact.fieldKey,
          originalValue: itemFact.originalValue,
          confidence: itemFact.confidence,
          evidenceStatus: itemFact.evidenceStatus,
          sourceQuote: itemFact.sourceQuote,
          sourceDocumentId: item.id,
          uncertaintyNote: itemFact.uncertaintyNote,
          reviewDecision: 'PENDING' as const,
          createdAt: NOW,
        })),
      )
      .run();
  }
  return db;
}

void test('case aggregation pre-populates high-confidence facts and surfaces only real exceptions', () => {
  const fields = aggregateCaseDocuments(createDocuments());
  const byKey = new Map(fields.map((field) => [field.fieldKey, field]));

  assert.equal(byKey.get('patientName')?.status, 'AUTO_POPULATED');
  assert.equal(byKey.get('patientName')?.aiProposedValue, 'Demo Patient');
  assert.equal(byKey.get('patientName')?.sources.length, 2);
  assert.equal(byKey.get('requestedEquipment')?.status, 'NEEDS_REVIEW');
  assert.equal(byKey.get('dateOfBirth')?.status, 'CONFLICT');
  assert.equal(byKey.get('dateOfBirth')?.aiProposedValue, null);
  assert.equal(byKey.get('memberPolicyId')?.status, 'MISSING');
});

void test('human-verified extraction facts map to canonical provider and equipment fields', () => {
  const documents = createDocuments().map((document) => ({
    ...document,
    analyses: document.analyses.map((analysis) => ({
      ...analysis,
      facts: [
        ...analysis.facts.map((fact) =>
          fact.fieldKey === 'requestedEquipment'
            ? { ...fact, reviewDecision: 'ACCEPTED' as const, reviewedValue: fact.originalValue }
            : fact,
        ),
        ...(analysis.id === 'analysis-a'
          ? [{ ...fact('10000000-0000-4000-8000-000000000006', document.id, 'providerName', 'Dr. Taylor Morgan', 'Ordering provider: Dr. Taylor Morgan', 'HIGH'), reviewDecision: 'ACCEPTED' as const, reviewedValue: 'Dr. Taylor Morgan' }]
          : []),
      ],
    })),
  }));
  const fields = new Map(aggregateCaseDocuments(documents).map((field) => [field.fieldKey, field]));
  assert.equal(fields.get('orderingProvider')?.status, 'VERIFIED');
  assert.equal(fields.get('requestedEquipment')?.status, 'VERIFIED');
});

void test('trusted case disagreement with a verified source remains a conflict', () => {
  const documents = createDocuments().map((document) => ({
    ...document,
    analyses: document.analyses.map((analysis) => ({
      ...analysis,
      facts: analysis.facts.map((item) => item.fieldKey === 'requestedEquipment'
        ? { ...item, reviewDecision: 'ACCEPTED' as const, reviewedValue: item.originalValue }
        : item),
    })),
  }));
  const conflict = aggregateCaseDocuments(documents, {
    patientName: 'Demo Patient',
    requestedEquipment: 'Demo device',
    insurer: 'Demo Payer',
    insurerPlan: 'Demo Plan',
  }).find((field) => field.fieldKey === 'requestedEquipment');
  assert.equal(conflict?.status, 'CONFLICT');
});

void test('draft generation persists traceability, preserves human values on refresh, and audits without values', async () => {
  const documents = createDocuments();
  const db = createFixture(documents);
  const summaryProvider = new GroundedSummaryProvider();
  const initial = await generatePriorAuthDraft(
    { caseId: CASE_ID, documents, actorUserId: USER_ID, summaryProvider },
    db,
  );

  const patient = initial.fields.find((field) => field.fieldKey === 'patientName')!;
  const dateOfBirth = initial.fields.find((field) => field.fieldKey === 'dateOfBirth')!;
  assert.equal(patient.status, 'AUTO_POPULATED');
  assert.equal(patient.sources.length, 2);
  assert.equal(dateOfBirth.status, 'CONFLICT');
  assert.equal(initial.notes.conflictingInformation.length, 1);
  assert.ok(initial.notes.missingInformation.length > 0);

  const resolved = saveVerifiedDraftValue(
    {
      caseId: CASE_ID,
      fieldId: dateOfBirth.id,
      value: '04/12/1970',
      actorUserId: USER_ID,
    },
    db,
  );
  assert.equal(
    resolved.fields.find((field) => field.id === dateOfBirth.id)?.status,
    'VERIFIED',
  );

  const refreshed = await generatePriorAuthDraft(
    { caseId: CASE_ID, documents, actorUserId: USER_ID, summaryProvider },
    db,
  );
  const refreshedDob = refreshed.fields.find((field) => field.id === dateOfBirth.id)!;
  assert.equal(refreshed.revision, 2);
  assert.equal(refreshedDob.status, 'VERIFIED');
  assert.equal(refreshedDob.humanVerifiedValue, '04/12/1970');
  assert.equal(refreshedDob.aiProposedValue, null);

  const events = db.select().from(auditEvents).all();
  assert.deepEqual(
    events.map((event) => event.action),
    [
      'case.prior_auth_draft_generated',
      'case.prior_auth_draft_conflict_resolved',
      'case.prior_auth_draft_refreshed',
    ],
  );
  const serializedAudit = JSON.stringify(events);
  assert.equal(serializedAudit.includes('04/12/1970'), false);
  assert.equal(serializedAudit.includes('Demo Patient'), false);
});
