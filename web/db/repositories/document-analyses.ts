import { randomUUID } from 'node:crypto';

import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { getDatabase, type DatabaseClient } from '@/db/client';
import {
  documentAnalyses,
  extractedFacts,
  users,
  type DocumentAnalysisRecord,
  type ExtractedFactRecord,
} from '@/db/schema';
import {
  extractionFactKeys,
  type DocumentAnalysis,
  type ExtractedFact,
  type HumanReviewDecision,
  type ModelExtractionOutput,
} from '@/types/extraction';

function parseWarnings(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function toFactDto(
  fact: ExtractedFactRecord,
  reviewerDisplayName: string | null,
): ExtractedFact {
  const reviewDecision =
    fact.reviewDecision === 'PENDING' &&
    (fact.originalValue === null || fact.evidenceStatus === 'NOT_FOUND')
      ? 'AUTO_RESOLVED'
      : fact.reviewDecision === 'PENDING' &&
          fact.confidence === 'HIGH' &&
          fact.evidenceStatus === 'SUPPORTED'
        ? 'SUGGESTED'
        : fact.reviewDecision;
  return {
    id: fact.id,
    fieldKey: fact.fieldKey,
    originalValue: fact.originalValue,
    confidence: fact.confidence,
    evidenceStatus: fact.evidenceStatus,
    sourceQuote: fact.sourceQuote,
    sourceDocumentId: fact.sourceDocumentId,
    uncertaintyNote: fact.uncertaintyNote,
    reviewDecision,
    reviewedValue: fact.reviewedValue,
    reviewerDisplayName,
    reviewedAt: fact.reviewedAt?.toISOString() ?? null,
  };
}

function toAnalysisDto(
  analysis: DocumentAnalysisRecord,
  requesterDisplayName: string | null,
  facts: ExtractedFact[],
): DocumentAnalysis {
  return {
    id: analysis.id,
    caseId: analysis.caseId,
    documentId: analysis.documentId,
    status: analysis.status,
    provider: analysis.provider,
    model: analysis.model,
    detectedDocumentType: analysis.detectedDocumentType,
    classificationConfidence: analysis.classificationConfidence,
    classificationSourceQuote: analysis.classificationSourceQuote,
    classificationNeedsReview: analysis.classificationNeedsReview,
    warnings: parseWarnings(analysis.warningsJson),
    requestedByDisplayName: requesterDisplayName,
    requestedAt: analysis.requestedAt.toISOString(),
    completedAt: analysis.completedAt?.toISOString() ?? null,
    facts,
  };
}

export function createDocumentAnalysis(
  input: {
    caseId: string;
    documentId: string;
    requestedByUserId: string;
    provider: string;
    model: string;
  },
  db: DatabaseClient = getDatabase(),
): DocumentAnalysisRecord {
  return db
    .insert(documentAnalyses)
    .values({
      id: randomUUID(),
      ...input,
      status: 'PROCESSING',
      classificationNeedsReview: true,
      warningsJson: '[]',
      requestedAt: new Date(),
    })
    .returning()
    .get();
}

export function completeDocumentAnalysis(
  analysisId: string,
  documentId: string,
  output: ModelExtractionOutput,
  db: DatabaseClient = getDatabase(),
): void {
  const now = new Date();
  db.transaction((transaction) => {
    transaction
      .update(documentAnalyses)
      .set({
        status: 'COMPLETED',
        detectedDocumentType: output.classification.documentType,
        classificationConfidence: output.classification.confidence,
        classificationSourceQuote: output.classification.sourceQuote,
        classificationNeedsReview: output.classification.needsReview,
        warningsJson: JSON.stringify(output.warnings),
        completedAt: now,
        failureCode: null,
      })
      .where(eq(documentAnalyses.id, analysisId))
      .run();

    transaction
      .insert(extractedFacts)
      .values(
        extractionFactKeys.map((fieldKey) => ({
          id: randomUUID(),
          analysisId,
          fieldKey,
          originalValue: output.facts[fieldKey].value,
          confidence: output.facts[fieldKey].confidence,
          evidenceStatus: output.facts[fieldKey].evidenceStatus,
          sourceQuote: output.facts[fieldKey].sourceQuote,
          sourceDocumentId: documentId,
          uncertaintyNote: output.facts[fieldKey].uncertaintyNote,
          reviewDecision: 'PENDING' as const,
          createdAt: now,
        })),
      )
      .run();
  });
}

export function failDocumentAnalysis(
  analysisId: string,
  failureCode: string,
  db: DatabaseClient = getDatabase(),
): void {
  db.update(documentAnalyses)
    .set({ status: 'FAILED', failureCode, completedAt: new Date() })
    .where(eq(documentAnalyses.id, analysisId))
    .run();
}

export function listDocumentAnalysesForCase(
  caseId: string,
  db: DatabaseClient = getDatabase(),
): Map<string, DocumentAnalysis[]> {
  const analysisRows = db
    .select({ analysis: documentAnalyses, requesterName: users.displayName })
    .from(documentAnalyses)
    .leftJoin(users, eq(documentAnalyses.requestedByUserId, users.id))
    .where(eq(documentAnalyses.caseId, caseId))
    .orderBy(desc(documentAnalyses.requestedAt))
    .all();

  const analysisIds = analysisRows.map(({ analysis }) => analysis.id);
  const factRows = analysisIds.length
    ? db
        .select({ fact: extractedFacts, reviewerName: users.displayName })
        .from(extractedFacts)
        .leftJoin(users, eq(extractedFacts.reviewedByUserId, users.id))
        .where(inArray(extractedFacts.analysisId, analysisIds))
        .orderBy(asc(extractedFacts.createdAt))
        .all()
    : [];
  const factsByAnalysis = new Map<string, ExtractedFact[]>();
  for (const { fact, reviewerName } of factRows) {
    const facts = factsByAnalysis.get(fact.analysisId) ?? [];
    facts.push(toFactDto(fact, reviewerName));
    factsByAnalysis.set(fact.analysisId, facts);
  }

  const byDocument = new Map<string, DocumentAnalysis[]>();
  for (const { analysis, requesterName } of analysisRows) {
    const analyses = byDocument.get(analysis.documentId) ?? [];
    analyses.push(
      toAnalysisDto(
        analysis,
        requesterName,
        factsByAnalysis.get(analysis.id) ?? [],
      ),
    );
    byDocument.set(analysis.documentId, analyses);
  }
  return byDocument;
}

export function getDocumentAnalysis(
  caseId: string,
  documentId: string,
  analysisId: string,
  db: DatabaseClient = getDatabase(),
): DocumentAnalysis | undefined {
  return listDocumentAnalysesForCase(caseId, db)
    .get(documentId)
    ?.find((analysis) => analysis.id === analysisId);
}

export function findFactForReview(
  input: {
    caseId: string;
    documentId: string;
    analysisId: string;
    factId: string;
  },
  db: DatabaseClient = getDatabase(),
): ExtractedFactRecord | undefined {
  return db
    .select({ fact: extractedFacts })
    .from(extractedFacts)
    .innerJoin(
      documentAnalyses,
      eq(extractedFacts.analysisId, documentAnalyses.id),
    )
    .where(
      and(
        eq(extractedFacts.id, input.factId),
        eq(extractedFacts.analysisId, input.analysisId),
        eq(documentAnalyses.caseId, input.caseId),
        eq(documentAnalyses.documentId, input.documentId),
        eq(documentAnalyses.status, 'COMPLETED'),
        inArray(extractedFacts.reviewDecision, ['PENDING', 'SUGGESTED']),
      ),
    )
    .get()?.fact;
}

export function reviewExtractedFact(
  input: {
    factId: string;
    decision: HumanReviewDecision;
    reviewedValue: string | null;
    reviewerUserId: string;
  },
  db: DatabaseClient = getDatabase(),
): ExtractedFactRecord | undefined {
  return db
    .update(extractedFacts)
    .set({
      reviewDecision: input.decision,
      reviewedValue: input.reviewedValue,
      reviewedByUserId: input.reviewerUserId,
      reviewedAt: new Date(),
    })
    .where(eq(extractedFacts.id, input.factId))
    .returning()
    .get();
}
