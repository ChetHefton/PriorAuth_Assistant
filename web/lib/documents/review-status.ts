import type { DocumentAnalysis } from '@/types/extraction';
import type { DocumentReviewStatus } from '@/types/case';
export function deriveDocumentReviewStatus(analyses: DocumentAnalysis[]): DocumentReviewStatus {
  if (!analyses.length) return 'NOT_ANALYZED';
  const latest = analyses[0];
  if (latest.status === 'PROCESSING') return 'ANALYZING';
  if (latest.status === 'FAILED') return 'ANALYSIS_FAILED';
  const actionable = latest.facts.filter((fact) => fact.evidenceStatus !== 'NOT_FOUND' && fact.originalValue !== null);
  if (!actionable.length) return 'NO_ACTION_NEEDED';
  return actionable.some((fact) => fact.reviewDecision === 'PENDING' || fact.reviewDecision === 'SUGGESTED') ? 'Needs Review' : 'REVIEW_COMPLETE';
}
