import { ZodError } from 'zod';

import type { DatabaseClient } from '@/db/client';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import {
  getPriorAuthDraft,
  savePriorAuthDraft,
  updatePriorAuthDraftField,
} from '@/db/repositories/prior-auth-drafts';
import type { CaseDraftSummaryProvider } from '@/lib/ai/case-draft-summary-provider';
import { caseDraftNotesSchema } from '@/lib/ai/case-draft-summary-schema';
import {
  aggregateCaseDocuments,
  toDraftSummaryInput,
  type AggregatedDraftField,
} from '@/lib/drafts/aggregate-draft';
import type { CaseDocument } from '@/types/case';
import type { PriorAuthorizationCase } from '@/types/case';
import {
  criticalDraftFieldKeys,
  priorAuthDraftFieldLabels,
  type CaseDraftNotes,
  type CaseSummaryNote,
  type PriorAuthDraft,
} from '@/types/prior-auth-draft';

export class PriorAuthDraftServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'INVALID_SUMMARY'
      | 'SUMMARY_FAILED'
      | 'DRAFT_FIELD_NOT_FOUND',
  ) {
    super(message);
  }
}

function validateNoteReferences(
  notes: CaseDraftNotes,
  fields: AggregatedDraftField[],
): void {
  const byKey = new Map(fields.map((field) => [field.fieldKey, field]));
  const allFactIds = new Set(
    fields.flatMap((field) =>
      field.sources.map((source) => source.extractedFactId),
    ),
  );
  const sections: Array<{
    notes: CaseSummaryNote[];
    allowedStatus?: 'MISSING' | 'CONFLICT';
    requireSource: boolean;
  }> = [
    {
      notes: notes.keySupportingEvidence,
      requireSource: true,
    },
    {
      notes: notes.missingInformation,
      allowedStatus: 'MISSING',
      requireSource: false,
    },
    {
      notes: notes.conflictingInformation,
      allowedStatus: 'CONFLICT',
      requireSource: true,
    },
    {
      notes: notes.areasRequiringReview,
      requireSource: false,
    },
  ];

  for (const section of sections) {
    for (const note of section.notes) {
      if (
        note.sourceFactIds.some((id) => !allFactIds.has(id)) ||
        (section.requireSource && note.sourceFactIds.length === 0)
      ) {
        throw new PriorAuthDraftServiceError(
          'The AI case notes referenced unsupported evidence.',
          'INVALID_SUMMARY',
        );
      }
      if (
        section.allowedStatus &&
        note.fieldKeys.some(
          (fieldKey) => byKey.get(fieldKey)?.status !== section.allowedStatus,
        )
      ) {
        throw new PriorAuthDraftServiceError(
          'The AI case notes did not match the aggregated draft state.',
          'INVALID_SUMMARY',
        );
      }
    }
  }
}

function addRequiredExceptionNotes(
  notes: CaseDraftNotes,
  fields: AggregatedDraftField[],
): CaseDraftNotes {
  const missingKeys = new Set(
    notes.missingInformation.flatMap((note) => note.fieldKeys),
  );
  const conflictKeys = new Set(
    notes.conflictingInformation.flatMap((note) => note.fieldKeys),
  );
  const reviewKeys = new Set(
    notes.areasRequiringReview.flatMap((note) => note.fieldKeys),
  );

  const missingInformation = [...notes.missingInformation];
  const conflictingInformation = [...notes.conflictingInformation];
  const areasRequiringReview = [...notes.areasRequiringReview];
  for (const field of fields) {
    const label = priorAuthDraftFieldLabels[field.fieldKey];
    if (
      field.status === 'MISSING' &&
      criticalDraftFieldKeys.includes(field.fieldKey) &&
      !missingKeys.has(field.fieldKey) &&
      missingInformation.length < 6
    ) {
      missingInformation.push({
        text: `${label} is missing from the analyzed documents.`,
        fieldKeys: [field.fieldKey],
        sourceFactIds: [],
      });
    }
    if (
      field.status === 'CONFLICT' &&
      !conflictKeys.has(field.fieldKey) &&
      conflictingInformation.length < 6
    ) {
      conflictingInformation.push({
        text: `Conflicting values were found for ${label.toLowerCase()}.`,
        fieldKeys: [field.fieldKey],
        sourceFactIds: field.sources.map((source) => source.extractedFactId),
      });
    }
    if (
      field.status === 'NEEDS_REVIEW' &&
      !reviewKeys.has(field.fieldKey) &&
      areasRequiringReview.length < 6
    ) {
      areasRequiringReview.push({
        text: `${label} needs specialist review because its source is uncertain or ambiguous.`,
        fieldKeys: [field.fieldKey],
        sourceFactIds: field.sources.map((source) => source.extractedFactId),
      });
    }
  }

  return {
    ...notes,
    missingInformation,
    conflictingInformation,
    areasRequiringReview,
  };
}

export async function generatePriorAuthDraft(
  input: {
    caseId: string;
    documents: CaseDocument[];
    trustedCaseData?: Pick<PriorAuthorizationCase, 'patientName' | 'requestedEquipment' | 'insurer' | 'insurerPlan'>;
    actorUserId: string;
    summaryProvider: CaseDraftSummaryProvider;
  },
  db?: DatabaseClient,
): Promise<PriorAuthDraft> {
  const fields = aggregateCaseDocuments(input.documents, input.trustedCaseData);
  let notes: CaseDraftNotes;
  try {
    const rawNotes = await input.summaryProvider.summarize(
      toDraftSummaryInput(fields),
    );
    notes = caseDraftNotesSchema.parse(rawNotes);
    validateNoteReferences(notes, fields);
    notes = addRequiredExceptionNotes(notes, fields);
  } catch (error) {
    if (error instanceof PriorAuthDraftServiceError) throw error;
    throw new PriorAuthDraftServiceError(
      error instanceof ZodError
        ? 'The AI case notes did not match the required structure.'
        : 'The AI case notes could not be generated. Try again later.',
      error instanceof ZodError ? 'INVALID_SUMMARY' : 'SUMMARY_FAILED',
    );
  }

  const { draft, wasRefresh } = savePriorAuthDraft(
    {
      caseId: input.caseId,
      actorUserId: input.actorUserId,
      provider: input.summaryProvider.providerName,
      model: input.summaryProvider.modelName,
      notes,
      fields,
    },
    db,
  );
  recordAuditEvent(
    {
      userId: input.actorUserId,
      action: wasRefresh
        ? 'case.prior_auth_draft_refreshed'
        : 'case.prior_auth_draft_generated',
      resourceType: 'prior_auth_draft',
      resourceId: draft.id,
    },
    db,
  );
  return draft;
}

export function saveVerifiedDraftValue(
  input: {
    caseId: string;
    fieldId: string;
    value: string;
    actorUserId: string;
  },
  db?: DatabaseClient,
): PriorAuthDraft {
  const change = updatePriorAuthDraftField(input, db);
  if (!change) {
    throw new PriorAuthDraftServiceError(
      'Prior authorization draft field not found.',
      'DRAFT_FIELD_NOT_FOUND',
    );
  }

  const normalize = (value: string) =>
    value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  const action =
    change.previousStatus === 'CONFLICT'
      ? 'case.prior_auth_draft_conflict_resolved'
      : change.aiProposedValue &&
          normalize(change.aiProposedValue) !== normalize(input.value)
        ? 'case.prior_auth_draft_ai_overridden'
        : change.aiProposedValue
          ? 'case.prior_auth_draft_value_verified'
          : 'case.prior_auth_draft_value_corrected';
  recordAuditEvent(
    {
      userId: input.actorUserId,
      action,
      resourceType: 'prior_auth_draft_field',
      resourceId: input.fieldId,
    },
    db,
  );

  const draft = getPriorAuthDraft(input.caseId, db);
  if (!draft) {
    throw new PriorAuthDraftServiceError(
      'Prior authorization draft not found.',
      'DRAFT_FIELD_NOT_FOUND',
    );
  }
  return draft;
}
