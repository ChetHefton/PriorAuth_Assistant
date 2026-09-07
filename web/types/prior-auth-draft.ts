import type {
  ExtractionConfidence,
  ExtractionEvidenceStatus,
} from '@/types/extraction';

export const priorAuthDraftFieldKeys = [
  'patientName',
  'dateOfBirth',
  'memberPolicyId',
  'orderingProvider',
  'providerNpi',
  'orderDate',
  'payerInsurer',
  'requestedEquipment',
  'requestedAccessories',
  'hcpcsCodes',
  'orderDetails',
  'diagnosisTermsCodes',
  'functionalLimitations',
  'evaluationFindings',
  'medicalRationale',
  'evaluationDates',
] as const;

export const priorAuthDraftFieldStatuses = [
  'MISSING',
  'AUTO_POPULATED',
  'NEEDS_REVIEW',
  'CONFLICT',
  'VERIFIED',
] as const;

export type PriorAuthDraftFieldKey =
  (typeof priorAuthDraftFieldKeys)[number];
export type PriorAuthDraftFieldStatus =
  (typeof priorAuthDraftFieldStatuses)[number];

export const priorAuthDraftFieldLabels: Record<
  PriorAuthDraftFieldKey,
  string
> = {
  patientName: 'Patient name',
  dateOfBirth: 'Date of birth',
  memberPolicyId: 'Member / policy ID',
  orderingProvider: 'Ordering provider',
  providerNpi: 'Provider identifier / NPI',
  orderDate: 'Relevant order date',
  payerInsurer: 'Payer / insurer',
  requestedEquipment: 'Requested medical equipment',
  requestedAccessories: 'Accessories / components',
  hcpcsCodes: 'HCPCS codes',
  orderDetails: 'Order details',
  diagnosisTermsCodes: 'Diagnosis terms / codes',
  functionalLimitations: 'Functional limitations',
  evaluationFindings: 'Relevant evaluation findings',
  medicalRationale: 'Stated medical rationale',
  evaluationDates: 'Relevant evaluation dates',
};

export const priorAuthDraftSections: ReadonlyArray<{
  id: 'PATIENT' | 'PROVIDER' | 'INSURANCE' | 'REQUEST' | 'CLINICAL_SUPPORT';
  label: string;
  fields: readonly PriorAuthDraftFieldKey[];
}> = [
  {
    id: 'PATIENT',
    label: 'Patient',
    fields: ['patientName', 'dateOfBirth', 'memberPolicyId'],
  },
  {
    id: 'PROVIDER',
    label: 'Provider',
    fields: ['orderingProvider', 'providerNpi', 'orderDate'],
  },
  {
    id: 'INSURANCE',
    label: 'Insurance',
    fields: ['payerInsurer'],
  },
  {
    id: 'REQUEST',
    label: 'Request',
    fields: [
      'requestedEquipment',
      'requestedAccessories',
      'hcpcsCodes',
      'orderDetails',
    ],
  },
  {
    id: 'CLINICAL_SUPPORT',
    label: 'Clinical support',
    fields: [
      'diagnosisTermsCodes',
      'functionalLimitations',
      'evaluationFindings',
      'medicalRationale',
      'evaluationDates',
    ],
  },
];

export const criticalDraftFieldKeys: readonly PriorAuthDraftFieldKey[] = [
  'patientName',
  'dateOfBirth',
  'memberPolicyId',
  'orderingProvider',
  'payerInsurer',
  'requestedEquipment',
];

export type PriorAuthDraftSource = {
  extractedFactId: string;
  documentId: string;
  documentFilename: string;
  documentType: string;
  value: string;
  confidence: ExtractionConfidence;
  evidenceStatus: ExtractionEvidenceStatus;
  sourceQuote: string;
  valueOrigin: 'AI_POPULATED' | 'HUMAN_VERIFIED' | 'HUMAN_CORRECTED';
};

export type PriorAuthDraftField = {
  id: string;
  fieldKey: PriorAuthDraftFieldKey;
  status: PriorAuthDraftFieldStatus;
  aiProposedValue: string | null;
  humanVerifiedValue: string | null;
  displayValue: string | null;
  editedByDisplayName: string | null;
  editedAt: string | null;
  sources: PriorAuthDraftSource[];
};

export type CaseSummaryNote = {
  text: string;
  fieldKeys: PriorAuthDraftFieldKey[];
  sourceFactIds: string[];
};

export type CaseDraftNotes = {
  keySupportingEvidence: CaseSummaryNote[];
  missingInformation: CaseSummaryNote[];
  conflictingInformation: CaseSummaryNote[];
  areasRequiringReview: CaseSummaryNote[];
};

export type PriorAuthDraft = {
  id: string;
  caseId: string;
  revision: number;
  generatedByDisplayName: string | null;
  generatedAt: string;
  updatedAt: string;
  fields: PriorAuthDraftField[];
  notes: CaseDraftNotes;
};

export type DraftSummaryProviderInput = {
  fields: Array<{
    fieldKey: PriorAuthDraftFieldKey;
    label: string;
    status: PriorAuthDraftFieldStatus;
    candidates: Array<{
      extractedFactId: string;
      value: string;
      confidence: ExtractionConfidence;
      evidenceStatus: ExtractionEvidenceStatus;
      sourceQuote: string;
      documentType: string;
    }>;
  }>;
};
