import type {
  DocumentationType,
  PriorAuthorizationCase,
  CaseDocument,
} from '@/types/case';
import type { PriorAuthDraft } from '@/types/prior-auth-draft';

export const policyRequirementKinds = ['DOCUMENT', 'FIELD'] as const;
export type PolicyRequirementKind = (typeof policyRequirementKinds)[number];

export const policyConditionTypes = [
  'ALWAYS',
  'EQUIPMENT_CATEGORY_IS',
  'EQUIPMENT_CONTAINS',
  'HCPCS_CODE_PRESENT',
] as const;
export type PolicyConditionType = (typeof policyConditionTypes)[number];

export const policyRequirementLevels = ['REQUIRED', 'ADVISORY'] as const;
export type PolicyRequirementLevel = (typeof policyRequirementLevels)[number];

export const policySelectionTypes = ['AUTOMATIC', 'MANUAL'] as const;
export type PolicySelectionType = (typeof policySelectionTypes)[number];

export const policyMatchStatuses = [
  'MATCHED',
  'NO_MATCH',
  'AMBIGUOUS',
  'INSUFFICIENT_DATA',
] as const;
export type PolicyMatchStatus = (typeof policyMatchStatuses)[number];

export const readinessStatuses = [
  'READY_FOR_SPECIALIST_REVIEW',
  'MISSING_DOCUMENTATION',
  'NEEDS_HUMAN_REVIEW',
  'POLICY_MATCH_UNCLEAR',
  'CONFLICT_DETECTED',
] as const;
export type ReadinessStatus = (typeof readinessStatuses)[number];

export const requirementResultStatuses = [
  'PRESENT',
  'MISSING',
  'NEEDS_REVIEW',
  'CONFLICT',
  'NOT_APPLICABLE',
] as const;
export type RequirementResultStatus =
  (typeof requirementResultStatuses)[number];

export type Payer = {
  id: string;
  name: string;
  planName: string;
  isActive: boolean;
};

export type PolicyRequirement = {
  id: string;
  policyId: string;
  requirementKey: string;
  label: string;
  kind: PolicyRequirementKind;
  documentType: DocumentationType | null;
  fieldKey: string | null;
  conditionType: PolicyConditionType;
  conditionValue: string | null;
  requirementLevel: PolicyRequirementLevel;
  explanation: string;
  blocksReadiness: boolean;
  sortOrder: number;
};

export type PayerPolicy = {
  id: string;
  payerId: string;
  payerName: string;
  planName: string;
  policyName: string;
  equipmentCategory: string;
  hcpcsCodes: string[];
  effectiveDate: string;
  expirationDate: string | null;
  submissionChannel: string;
  followUpIntervalDays: number | null;
  sourceType: string;
  sourceReference: string;
  notes: string;
  version: string;
  isSynthetic: boolean;
  isActive: boolean;
  requirements: PolicyRequirement[];
};

export type PolicyOption = Pick<
  PayerPolicy,
  | 'id'
  | 'payerName'
  | 'planName'
  | 'policyName'
  | 'equipmentCategory'
  | 'version'
  | 'effectiveDate'
  | 'expirationDate'
  | 'submissionChannel'
  | 'followUpIntervalDays'
  | 'sourceType'
  | 'sourceReference'
  | 'isSynthetic'
>;

export type PolicyMatch = {
  status: PolicyMatchStatus;
  policy: PayerPolicy | null;
  candidates: PolicyOption[];
  reason: string;
};

export type ReadinessRequirementResult = {
  id: string;
  requirementId: string;
  requirementKey: string;
  label: string;
  status: RequirementResultStatus;
  reason: string;
  sourceDocumentIds: string[];
  sourceFieldKeys: string[];
  explanation: string;
  blocksReadiness: boolean;
};

export type ReadinessEvaluation = {
  id: string;
  caseId: string;
  policy: PolicyOption | null;
  policyMatchStatus: PolicyMatchStatus;
  policyMatchReason: string;
  selectionType: PolicySelectionType | null;
  status: ReadinessStatus;
  satisfiedCount: number;
  applicableCount: number;
  nextBestAction: string;
  evaluatedAt: string;
  evaluatedByDisplayName: string | null;
  requirements: ReadinessRequirementResult[];
};

export type ReadinessInput = {
  caseData: PriorAuthorizationCase;
  draft: PriorAuthDraft | null;
  documents: CaseDocument[];
};
