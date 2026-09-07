import { ZodError } from 'zod';

import type { DatabaseClient } from '@/db/client';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import {
  completeDocumentAnalysis,
  createDocumentAnalysis,
  failDocumentAnalysis,
  findFactForReview,
  getDocumentAnalysis,
  reviewExtractedFact,
} from '@/db/repositories/document-analyses';
import { touchPriorAuthDraft } from '@/db/repositories/prior-auth-drafts';
import type { CaseDocumentRecord } from '@/db/schema';
import type { DocumentAnalysisProvider } from '@/lib/ai/document-analysis-provider';
import {
  assertGroundedExtraction,
  ExtractionGroundingError,
  parseModelExtractionOutput,
} from '@/lib/ai/extraction-schema';
import type {
  DocumentAnalysis,
  HumanReviewDecision,
} from '@/types/extraction';

export class DocumentAnalysisServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'INVALID_MODEL_OUTPUT'
      | 'MODEL_REQUEST_FAILED'
      | 'FACT_NOT_FOUND'
      | 'INVALID_REVIEW',
  ) {
    super(message);
  }
}

function safeFailureCode(
  error: unknown,
): 'INVALID_MODEL_OUTPUT' | 'MODEL_REQUEST_FAILED' {
  return error instanceof ZodError || error instanceof ExtractionGroundingError
    ? 'INVALID_MODEL_OUTPUT'
    : 'MODEL_REQUEST_FAILED';
}

export async function analyzeDocument(
  input: {
    caseId: string;
    document: CaseDocumentRecord;
    documentText: string;
    actorUserId: string;
    provider: DocumentAnalysisProvider;
  },
  db?: DatabaseClient,
): Promise<DocumentAnalysis> {
  const analysis = createDocumentAnalysis(
    {
      caseId: input.caseId,
      documentId: input.document.id,
      requestedByUserId: input.actorUserId,
      provider: input.provider.providerName,
      model: input.provider.modelName,
    },
    db,
  );
  recordAuditEvent(
    {
      userId: input.actorUserId,
      action: 'document.analysis_requested',
      resourceType: 'document',
      resourceId: input.document.id,
    },
    db,
  );

  try {
    const rawOutput = await input.provider.extract({
      documentText: input.documentText,
    });
    const output = parseModelExtractionOutput(rawOutput);
    assertGroundedExtraction(output, input.documentText);
    completeDocumentAnalysis(analysis.id, input.document.id, output, db);
    recordAuditEvent(
      {
        userId: input.actorUserId,
        action: 'document.analysis_completed',
        resourceType: 'document_analysis',
        resourceId: analysis.id,
      },
      db,
    );
  } catch (error) {
    const code = safeFailureCode(error);
    failDocumentAnalysis(analysis.id, code, db);
    throw new DocumentAnalysisServiceError(
      code === 'INVALID_MODEL_OUTPUT'
        ? 'The AI response could not be verified against the document. Try again.'
        : 'The AI analysis could not be completed. Try again later.',
      code,
    );
  }

  const completed = getDocumentAnalysis(
    input.caseId,
    input.document.id,
    analysis.id,
    db,
  );
  if (!completed) {
    throw new DocumentAnalysisServiceError(
      'The completed analysis could not be loaded.',
      'MODEL_REQUEST_FAILED',
    );
  }
  return completed;
}

export function reviewFact(
  input: {
    caseId: string;
    documentId: string;
    analysisId: string;
    factId: string;
    decision: HumanReviewDecision;
    reviewedValue?: string;
    actorUserId: string;
  },
  db?: DatabaseClient,
): DocumentAnalysis {
  const fact = findFactForReview(input, db);
  if (!fact) {
    throw new DocumentAnalysisServiceError(
      'Extracted fact not found.',
      'FACT_NOT_FOUND',
    );
  }

  const editedValue = input.reviewedValue?.trim() || null;
  if (input.decision === 'REJECTED' && fact.originalValue === null) {
    throw new DocumentAnalysisServiceError(
      'Missing information is not an incorrect AI value and cannot be rejected.',
      'INVALID_REVIEW',
    );
  }
  if (input.decision === 'ACCEPTED' && fact.originalValue === null) {
    throw new DocumentAnalysisServiceError(
      'A missing AI value cannot be accepted without an edit.',
      'INVALID_REVIEW',
    );
  }
  if (input.decision === 'EDITED' && !editedValue) {
    throw new DocumentAnalysisServiceError(
      'Enter a reviewed value before accepting an edit.',
      'INVALID_REVIEW',
    );
  }

  reviewExtractedFact(
    {
      factId: fact.id,
      decision: input.decision,
      reviewedValue:
        input.decision === 'ACCEPTED'
          ? fact.originalValue
          : input.decision === 'EDITED'
            ? editedValue
            : null,
      reviewerUserId: input.actorUserId,
    },
    db,
  );
  touchPriorAuthDraft(input.caseId, db);

  const action = {
    ACCEPTED: 'extracted_fact.accepted',
    EDITED: 'extracted_fact.edited',
    REJECTED: 'extracted_fact.rejected',
  }[input.decision];
  recordAuditEvent(
    {
      userId: input.actorUserId,
      action,
      resourceType: 'extracted_fact',
      resourceId: fact.id,
    },
    db,
  );

  const analysis = getDocumentAnalysis(
    input.caseId,
    input.documentId,
    input.analysisId,
    db,
  );
  if (!analysis) {
    throw new DocumentAnalysisServiceError(
      'Document analysis not found.',
      'FACT_NOT_FOUND',
    );
  }
  return analysis;
}
