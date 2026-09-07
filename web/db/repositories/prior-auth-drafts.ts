import { randomUUID } from 'node:crypto';

import { and, asc, eq } from 'drizzle-orm';

import { getDatabase, type DatabaseClient } from '@/db/client';
import {
  caseDocuments,
  documentAnalyses,
  extractedFacts,
  priorAuthDraftFields,
  priorAuthDraftFieldSources,
  priorAuthDrafts,
  users,
} from '@/db/schema';
import { caseDraftNotesSchema } from '@/lib/ai/case-draft-summary-schema';
import type { AggregatedDraftField } from '@/lib/drafts/aggregate-draft';
import type {
  CaseDraftNotes,
  PriorAuthDraft,
  PriorAuthDraftField,
  PriorAuthDraftSource,
} from '@/types/prior-auth-draft';

const EMPTY_NOTES: CaseDraftNotes = {
  keySupportingEvidence: [],
  missingInformation: [],
  conflictingInformation: [],
  areasRequiringReview: [],
};

function parseNotes(value: string): CaseDraftNotes {
  try {
    return caseDraftNotesSchema.parse(JSON.parse(value));
  } catch {
    return EMPTY_NOTES;
  }
}

export function getPriorAuthDraft(
  caseId: string,
  db: DatabaseClient = getDatabase(),
): PriorAuthDraft | null {
  const row = db
    .select({ draft: priorAuthDrafts, generatorName: users.displayName })
    .from(priorAuthDrafts)
    .leftJoin(users, eq(priorAuthDrafts.generatedByUserId, users.id))
    .where(eq(priorAuthDrafts.caseId, caseId))
    .get();
  if (!row) return null;

  const fieldRows = db
    .select({ field: priorAuthDraftFields, editorName: users.displayName })
    .from(priorAuthDraftFields)
    .leftJoin(users, eq(priorAuthDraftFields.editedByUserId, users.id))
    .where(eq(priorAuthDraftFields.draftId, row.draft.id))
    .orderBy(asc(priorAuthDraftFields.createdAt))
    .all();

  const sourceRows = db
    .select({
      draftFieldId: priorAuthDraftFieldSources.draftFieldId,
      fact: extractedFacts,
      documentId: caseDocuments.id,
      documentFilename: caseDocuments.originalFilename,
      fallbackDocumentType: caseDocuments.documentType,
      detectedDocumentType: documentAnalyses.detectedDocumentType,
    })
    .from(priorAuthDraftFieldSources)
    .innerJoin(
      extractedFacts,
      eq(priorAuthDraftFieldSources.extractedFactId, extractedFacts.id),
    )
    .innerJoin(
      documentAnalyses,
      eq(extractedFacts.analysisId, documentAnalyses.id),
    )
    .innerJoin(
      caseDocuments,
      eq(extractedFacts.sourceDocumentId, caseDocuments.id),
    )
    .innerJoin(
      priorAuthDraftFields,
      eq(priorAuthDraftFieldSources.draftFieldId, priorAuthDraftFields.id),
    )
    .where(eq(priorAuthDraftFields.draftId, row.draft.id))
    .all();

  const sourcesByField = new Map<string, PriorAuthDraftSource[]>();
  for (const source of sourceRows) {
    const value =
      source.fact.reviewDecision === 'ACCEPTED' ||
      source.fact.reviewDecision === 'EDITED'
        ? source.fact.reviewedValue
        : source.fact.originalValue;
    if (!value || !source.fact.sourceQuote) continue;
    const sources = sourcesByField.get(source.draftFieldId) ?? [];
    sources.push({
      extractedFactId: source.fact.id,
      documentId: source.documentId,
      documentFilename: source.documentFilename,
      documentType:
        source.detectedDocumentType ?? source.fallbackDocumentType,
      value,
      confidence: source.fact.confidence,
      evidenceStatus: source.fact.evidenceStatus,
      sourceQuote: source.fact.sourceQuote,
      valueOrigin:
        source.fact.reviewDecision === 'EDITED'
          ? 'HUMAN_CORRECTED'
          : source.fact.reviewDecision === 'ACCEPTED'
            ? 'HUMAN_VERIFIED'
            : 'AI_POPULATED',
    });
    sourcesByField.set(source.draftFieldId, sources);
  }

  const fields: PriorAuthDraftField[] = fieldRows.map(
    ({ field, editorName }) => ({
      id: field.id,
      fieldKey: field.fieldKey,
      status: field.status,
      aiProposedValue: field.aiProposedValue,
      humanVerifiedValue: field.humanVerifiedValue,
      displayValue: field.humanVerifiedValue ?? field.aiProposedValue,
      editedByDisplayName: editorName,
      editedAt: field.editedAt?.toISOString() ?? null,
      sources: sourcesByField.get(field.id) ?? [],
    }),
  );

  return {
    id: row.draft.id,
    caseId: row.draft.caseId,
    revision: row.draft.revision,
    generatedByDisplayName: row.generatorName,
    generatedAt: row.draft.generatedAt.toISOString(),
    updatedAt: row.draft.updatedAt.toISOString(),
    fields,
    notes: parseNotes(row.draft.notesJson),
  };
}

export function savePriorAuthDraft(
  input: {
    caseId: string;
    actorUserId: string;
    provider: string;
    model: string;
    notes: CaseDraftNotes;
    fields: AggregatedDraftField[];
  },
  db: DatabaseClient = getDatabase(),
): { draft: PriorAuthDraft; wasRefresh: boolean } {
  const now = new Date();
  const existing = db
    .select()
    .from(priorAuthDrafts)
    .where(eq(priorAuthDrafts.caseId, input.caseId))
    .get();
  const draftId = existing?.id ?? randomUUID();

  db.transaction((transaction) => {
    if (existing) {
      transaction
        .update(priorAuthDrafts)
        .set({
          revision: existing.revision + 1,
          notesJson: JSON.stringify(input.notes),
          summaryProvider: input.provider,
          summaryModel: input.model,
          generatedByUserId: input.actorUserId,
          generatedAt: now,
          updatedAt: now,
        })
        .where(eq(priorAuthDrafts.id, draftId))
        .run();
    } else {
      transaction
        .insert(priorAuthDrafts)
        .values({
          id: draftId,
          caseId: input.caseId,
          revision: 1,
          notesJson: JSON.stringify(input.notes),
          summaryProvider: input.provider,
          summaryModel: input.model,
          generatedByUserId: input.actorUserId,
          generatedAt: now,
          updatedAt: now,
        })
        .run();
    }

    const existingFields = transaction
      .select()
      .from(priorAuthDraftFields)
      .where(eq(priorAuthDraftFields.draftId, draftId))
      .all();
    const existingByKey = new Map(
      existingFields.map((field) => [field.fieldKey, field]),
    );

    for (const aggregate of input.fields) {
      const current = existingByKey.get(aggregate.fieldKey);
      const fieldId = current?.id ?? randomUUID();
      const inheritedHumanValue = current?.humanVerifiedValue ??
        (aggregate.status === 'VERIFIED'
          ? aggregate.sources.find((source) =>
              source.valueOrigin === 'HUMAN_VERIFIED' ||
              source.valueOrigin === 'HUMAN_CORRECTED',
            )?.value ?? null
          : null);
      const status = aggregate.trustedConflict
        ? 'CONFLICT'
        : inheritedHumanValue
          ? 'VERIFIED'
          : aggregate.status;
      if (current) {
        transaction
          .update(priorAuthDraftFields)
          .set({
            status,
            aiProposedValue: aggregate.aiProposedValue,
            humanVerifiedValue: inheritedHumanValue,
            updatedAt: now,
          })
          .where(eq(priorAuthDraftFields.id, fieldId))
          .run();
        transaction
          .delete(priorAuthDraftFieldSources)
          .where(eq(priorAuthDraftFieldSources.draftFieldId, fieldId))
          .run();
      } else {
        transaction
          .insert(priorAuthDraftFields)
          .values({
            id: fieldId,
            draftId,
            fieldKey: aggregate.fieldKey,
            status,
            aiProposedValue: aggregate.aiProposedValue,
            humanVerifiedValue: inheritedHumanValue,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
      if (aggregate.sources.length) {
        transaction
          .insert(priorAuthDraftFieldSources)
          .values(
            aggregate.sources.map((source) => ({
              id: randomUUID(),
              draftFieldId: fieldId,
              extractedFactId: source.extractedFactId,
            })),
          )
          .run();
      }
    }
  });

  const draft = getPriorAuthDraft(input.caseId, db);
  if (!draft) throw new Error('Saved prior authorization draft was not found.');
  return { draft, wasRefresh: Boolean(existing) };
}

export function updatePriorAuthDraftField(
  input: {
    caseId: string;
    fieldId: string;
    value: string;
    actorUserId: string;
  },
  db: DatabaseClient = getDatabase(),
): { previousStatus: string; aiProposedValue: string | null } | null {
  const existing = db
    .select({ field: priorAuthDraftFields })
    .from(priorAuthDraftFields)
    .innerJoin(
      priorAuthDrafts,
      eq(priorAuthDraftFields.draftId, priorAuthDrafts.id),
    )
    .where(
      and(
        eq(priorAuthDraftFields.id, input.fieldId),
        eq(priorAuthDrafts.caseId, input.caseId),
      ),
    )
    .get()?.field;
  if (!existing) return null;

  const now = new Date();
  db.transaction((transaction) => {
    transaction
      .update(priorAuthDraftFields)
      .set({
        status: 'VERIFIED',
        humanVerifiedValue: input.value,
        editedByUserId: input.actorUserId,
        editedAt: now,
        updatedAt: now,
      })
      .where(eq(priorAuthDraftFields.id, input.fieldId))
      .run();
    transaction
      .update(priorAuthDrafts)
      .set({ updatedAt: now })
      .where(eq(priorAuthDrafts.id, existing.draftId))
      .run();
  });
  return {
    previousStatus: existing.status,
    aiProposedValue: existing.aiProposedValue,
  };
}

/** Mark an existing draft as changed without changing its verified values. */
export function touchPriorAuthDraft(
  caseId: string,
  db: DatabaseClient = getDatabase(),
): void {
  db.update(priorAuthDrafts)
    .set({ updatedAt: new Date() })
    .where(eq(priorAuthDrafts.caseId, caseId))
    .run();
}
