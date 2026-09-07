import type { CaseDocument } from '@/types/case';
import type { PriorAuthorizationCase } from '@/types/case';
import type { ExtractedFact } from '@/types/extraction';
import { canonicalDraftFieldForFact } from '@/lib/drafts/canonical-field-map';
import {
  priorAuthDraftFieldLabels,
  priorAuthDraftFieldKeys,
  type DraftSummaryProviderInput,
  type PriorAuthDraftFieldKey,
  type PriorAuthDraftFieldStatus,
  type PriorAuthDraftSource,
} from '@/types/prior-auth-draft';

export type AggregatedDraftField = {
  fieldKey: PriorAuthDraftFieldKey;
  status: PriorAuthDraftFieldStatus;
  aiProposedValue: string | null;
  sources: PriorAuthDraftSource[];
  trustedConflict?: boolean;
};

function normalizeCandidate(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function semanticCandidate(fieldKey: PriorAuthDraftFieldKey, value: string): string {
  const normalized = normalizeCandidate(value);
  if (fieldKey === 'requestedEquipment') {
    return normalized
      .replace(/custom\s+/g, '')
      .replace(/power(?:ed)?\s+mobility(?:\s+device)?/g, 'power wheelchair')
      .replace(/\s+configuration/g, '')
      .replace(/\s+with\s+.+$/g, '')
      .trim();
  }
  if (['functionalLimitations', 'evaluationFindings', 'medicalRationale'].includes(fieldKey)) {
    return normalized.replace(/\b(cannot safely complete household mobility with a cane or walker|limited walking tolerance|need for powered mobility for household activities)\b/g, 'powered mobility limitation');
  }
  return normalized;
}

function candidateValue(fact: ExtractedFact): string | null {
  if (fact.reviewDecision === 'REJECTED') return null;
  if (
    fact.reviewDecision === 'ACCEPTED' ||
    fact.reviewDecision === 'EDITED'
  ) {
    return fact.reviewedValue;
  }
  return fact.originalValue;
}

function sourceOrigin(
  fact: ExtractedFact,
): PriorAuthDraftSource['valueOrigin'] {
  if (fact.reviewDecision === 'EDITED') return 'HUMAN_CORRECTED';
  if (fact.reviewDecision === 'ACCEPTED') return 'HUMAN_VERIFIED';
  return 'AI_POPULATED';
}

export function aggregateCaseDocuments(
  documents: CaseDocument[],
  trustedCaseData?: Pick<PriorAuthorizationCase, 'patientName' | 'requestedEquipment' | 'insurer' | 'insurerPlan'>,
): AggregatedDraftField[] {
  const trusted: Partial<Record<PriorAuthDraftFieldKey, string>> = {
    patientName: trustedCaseData?.patientName,
    requestedEquipment: trustedCaseData?.requestedEquipment,
    payerInsurer: trustedCaseData
      ? `${trustedCaseData.insurer}${trustedCaseData.insurerPlan ? ` — ${trustedCaseData.insurerPlan}` : ''}`
      : undefined,
  };
  const sourcesByField = new Map<
    PriorAuthDraftFieldKey,
    PriorAuthDraftSource[]
  >();

  for (const document of documents) {
    if (document.archivedAt) continue;
    const analysis = document.analyses.find(
      (item) => item.status === 'COMPLETED',
    );
    if (!analysis) continue;

    for (const fact of analysis.facts) {
      const fieldKey = canonicalDraftFieldForFact(fact.fieldKey, analysis.detectedDocumentType);
      const value = candidateValue(fact);
      if (!fieldKey || !value || !fact.sourceQuote) continue;

      const sources = sourcesByField.get(fieldKey) ?? [];
      sources.push({
        extractedFactId: fact.id,
        documentId: document.id,
        documentFilename: document.originalFilename,
        documentType:
          analysis.detectedDocumentType ?? document.documentType,
        value,
        confidence: fact.confidence,
        evidenceStatus: fact.evidenceStatus,
        sourceQuote: fact.sourceQuote,
        valueOrigin: sourceOrigin(fact),
      });
      sourcesByField.set(fieldKey, sources);
    }
  }

  return priorAuthDraftFieldKeys.map((fieldKey) => {
    const sources = sourcesByField.get(fieldKey) ?? [];
    const trustedValue = trusted[fieldKey];
    if (trustedValue) {
      const humanSources = sources.filter(
        (source) => source.valueOrigin === 'HUMAN_VERIFIED' || source.valueOrigin === 'HUMAN_CORRECTED',
      );
      if (humanSources.some((source) => semanticCandidate(fieldKey, source.value) !== semanticCandidate(fieldKey, trustedValue))) {
        return { fieldKey, status: 'CONFLICT', aiProposedValue: null, sources, trustedConflict: true };
      }
      if (!humanSources.length) {
        // Trusted case-record values outrank unverified document suggestions.
        return { fieldKey, status: 'AUTO_POPULATED', aiProposedValue: trustedValue, sources: [] };
      }
    }
    if (!sources.length) {
      if (trusted[fieldKey]) {
        return { fieldKey, status: 'AUTO_POPULATED', aiProposedValue: trusted[fieldKey]!, sources };
      }
      return { fieldKey, status: 'MISSING', aiProposedValue: null, sources };
    }

    const uniqueValues = new Map<string, string>();
    for (const source of sources) {
      uniqueValues.set(semanticCandidate(fieldKey, source.value), source.value);
    }
    if (uniqueValues.size > 1) {
      return { fieldKey, status: 'CONFLICT', aiProposedValue: null, sources };
    }

    const humanSource = sources.find(
      (source) => source.valueOrigin === 'HUMAN_VERIFIED' || source.valueOrigin === 'HUMAN_CORRECTED',
    );
    if (humanSource) {
      return { fieldKey, status: 'VERIFIED', aiProposedValue: humanSource.value, sources };
    }

    const needsReview = sources.some(
      (source) =>
        source.valueOrigin === 'AI_POPULATED' &&
        (source.confidence !== 'HIGH' ||
          source.evidenceStatus !== 'SUPPORTED'),
    );
    return {
      fieldKey,
      status: needsReview ? 'NEEDS_REVIEW' : 'AUTO_POPULATED',
      aiProposedValue: [...uniqueValues.values()][0] ?? null,
      sources,
    };
  });
}

export function toDraftSummaryInput(
  fields: AggregatedDraftField[],
): DraftSummaryProviderInput {
  return {
    fields: fields.map((field) => ({
      fieldKey: field.fieldKey,
      label: priorAuthDraftFieldLabels[field.fieldKey],
      status: field.status,
      candidates: field.sources.map((source) => ({
        extractedFactId: source.extractedFactId,
        value: source.value,
        confidence: source.confidence,
        evidenceStatus: source.evidenceStatus,
        sourceQuote: source.sourceQuote,
        documentType: source.documentType,
      })),
    })),
  };
}
