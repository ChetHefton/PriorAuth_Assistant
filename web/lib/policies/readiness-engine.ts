import type { CaseDocument, PriorAuthorizationCase } from '@/types/case';
import type { PriorAuthDraft } from '@/types/prior-auth-draft';
import type {
  PayerPolicy,
  PolicyRequirement,
  ReadinessStatus,
  RequirementResultStatus,
  ReadinessRequirementResult,
} from '@/types/policy';

function normalized(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function conditionApplies(
  requirement: PolicyRequirement,
  caseData: PriorAuthorizationCase,
  draft: PriorAuthDraft | null,
): boolean {
  switch (requirement.conditionType) {
    case 'ALWAYS':
      return true;
    case 'EQUIPMENT_CATEGORY_IS':
      return normalized(caseData.equipmentCategory) === normalized(requirement.conditionValue ?? '');
    case 'EQUIPMENT_CONTAINS':
      return normalized(caseData.requestedEquipment).includes(normalized(requirement.conditionValue ?? ''));
    case 'HCPCS_CODE_PRESENT': {
      const field = draft?.fields.find((item) => item.fieldKey === 'hcpcsCodes');
      if (!field || field.status !== 'VERIFIED' || !field.displayValue) return false;
      return field.displayValue
        .split(/[,\s]+/)
        .map(normalized)
        .includes(normalized(requirement.conditionValue ?? ''));
    }
  }
}

function evaluateDocument(
  requirement: PolicyRequirement,
  documents: CaseDocument[],
): Pick<ReadinessRequirementResult, 'status' | 'reason' | 'sourceDocumentIds' | 'sourceFieldKeys'> {
  const matching = documents.filter((document) => document.documentType === requirement.documentType);
  const reviewed = matching.filter((document) => ['Reviewed', 'REVIEW_COMPLETE', 'NO_ACTION_NEEDED'].includes(document.reviewStatus));
  if (reviewed.length) {
    return {
      status: 'PRESENT',
      reason: `${reviewed.length} reviewed source document${reviewed.length === 1 ? '' : 's'} found.`,
      sourceDocumentIds: reviewed.map((document) => document.id),
      sourceFieldKeys: [],
    };
  }
  if (matching.length) {
    return {
      status: 'NEEDS_REVIEW',
      reason: 'A source document exists but has not completed human review.',
      sourceDocumentIds: matching.map((document) => document.id),
      sourceFieldKeys: [],
    };
  }
  return {
    status: 'MISSING',
    reason: 'No matching source document is present for this requirement.',
    sourceDocumentIds: [],
    sourceFieldKeys: [],
  };
}

function evaluateField(
  requirement: PolicyRequirement,
  draft: PriorAuthDraft | null,
): Pick<ReadinessRequirementResult, 'status' | 'reason' | 'sourceDocumentIds' | 'sourceFieldKeys'> {
  const field = draft?.fields.find((item) => item.fieldKey === requirement.fieldKey);
  if (!field || !field.displayValue) {
    return {
      status: 'MISSING',
      reason: 'No verified or trusted value is available.',
      sourceDocumentIds: [],
      sourceFieldKeys: requirement.fieldKey ? [requirement.fieldKey] : [],
    };
  }
  const sources = field.sources.map((source) => source.documentId);
  if (field.status === 'VERIFIED') {
    return {
      status: 'PRESENT',
      reason: 'Human-verified value available from source evidence.',
      sourceDocumentIds: sources,
      sourceFieldKeys: requirement.fieldKey ? [requirement.fieldKey] : [],
    };
  }
  if (field.status === 'AUTO_POPULATED' && field.sources.length === 0) {
    return {
      status: 'PRESENT',
      reason: 'Trusted case-record value available.',
      sourceDocumentIds: [],
      sourceFieldKeys: requirement.fieldKey ? [requirement.fieldKey] : [],
    };
  }
  if (field.status === 'CONFLICT') {
    return {
      status: 'CONFLICT',
      reason: 'Verified sources contain incompatible values.',
      sourceDocumentIds: sources,
      sourceFieldKeys: requirement.fieldKey ? [requirement.fieldKey] : [],
    };
  }
  return {
    status: 'NEEDS_REVIEW',
    reason: 'Only an unverified AI suggestion is available.',
    sourceDocumentIds: sources,
    sourceFieldKeys: requirement.fieldKey ? [requirement.fieldKey] : [],
  };
}

function nextAction(status: ReadinessStatus, results: ReadinessRequirementResult[]): string {
  if (status === 'POLICY_MATCH_UNCLEAR') return 'Confirm the appropriate synthetic payer policy before evaluating requirements.';
  const first = results.find((result) => result.blocksReadiness && result.status === 'CONFLICT');
  if (first) return `Resolve the conflicting ${first.label.toLowerCase()} value before preparing submission.`;
  const missing = results.find((result) => result.blocksReadiness && result.status === 'MISSING');
  if (missing) return `Obtain ${missing.label.toLowerCase()} before preparing submission.`;
  const review = results.find((result) => result.blocksReadiness && result.status === 'NEEDS_REVIEW');
  if (review) return `Complete specialist review for ${review.label.toLowerCase()}.`;
  return 'Configured administrative requirements are present; specialist review remains required.';
}

export function evaluatePolicyRequirements(input: {
  caseData: PriorAuthorizationCase;
  draft: PriorAuthDraft | null;
  documents: CaseDocument[];
  policy: PayerPolicy | null;
  policyMatchStatus: 'MATCHED' | 'NO_MATCH' | 'AMBIGUOUS' | 'INSUFFICIENT_DATA';
}): {
  status: ReadinessStatus;
  satisfiedCount: number;
  applicableCount: number;
  nextBestAction: string;
  requirements: ReadinessRequirementResult[];
} {
  if (!input.policy || input.policyMatchStatus !== 'MATCHED') {
    const status: ReadinessStatus = 'POLICY_MATCH_UNCLEAR';
    return {
      status,
      satisfiedCount: 0,
      applicableCount: 0,
      nextBestAction: nextAction(status, []),
      requirements: [],
    };
  }
  const requirements = input.policy.requirements.map((requirement) => {
    const applies = conditionApplies(requirement, input.caseData, input.draft);
    const result = applies
      ? requirement.kind === 'DOCUMENT'
        ? evaluateDocument(requirement, input.documents)
        : evaluateField(requirement, input.draft)
      : {
          status: 'NOT_APPLICABLE' as const,
          reason: 'The configured condition does not apply to this case.',
          sourceDocumentIds: [],
          sourceFieldKeys: [],
        };
    return {
      id: '',
      requirementId: requirement.id,
      requirementKey: requirement.requirementKey,
      label: requirement.label,
      status: result.status as RequirementResultStatus,
      reason: result.reason,
      sourceDocumentIds: result.sourceDocumentIds,
      sourceFieldKeys: result.sourceFieldKeys,
      explanation: requirement.explanation,
      blocksReadiness: requirement.blocksReadiness,
    };
  });
  const applicable = requirements.filter((result) => result.status !== 'NOT_APPLICABLE');
  const conflicts = applicable.filter((result) => result.blocksReadiness && result.status === 'CONFLICT');
  const missing = applicable.filter((result) => result.blocksReadiness && result.status === 'MISSING');
  const review = applicable.filter((result) => result.blocksReadiness && result.status === 'NEEDS_REVIEW');
  const status: ReadinessStatus = conflicts.length
    ? 'CONFLICT_DETECTED'
    : missing.length
      ? 'MISSING_DOCUMENTATION'
      : review.length
        ? 'NEEDS_HUMAN_REVIEW'
        : 'READY_FOR_SPECIALIST_REVIEW';
  return {
    status,
    satisfiedCount: applicable.filter((result) => result.status === 'PRESENT').length,
    applicableCount: applicable.length,
    nextBestAction: nextAction(status, requirements),
    requirements,
  };
}
