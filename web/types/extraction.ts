export const detectedDocumentTypes = [
  'Physician Order / Prescription',
  'Clinical Chart Notes',
  'PT/OT Evaluation',
  'Insurance Information',
  'Equipment Specification / Order',
  'Denial Letter',
  'Supporting Documentation',
  'Other / Unknown',
] as const;

export const extractionConfidences = ['HIGH', 'MEDIUM', 'LOW'] as const;

export const extractionEvidenceStatuses = [
  'SUPPORTED',
  'NEEDS_REVIEW',
  'CONTRADICTORY',
  'NOT_FOUND',
] as const;

export const extractionReviewDecisions = [
  'PENDING',
  'SUGGESTED',
  'AUTO_RESOLVED',
  'ACCEPTED',
  'EDITED',
  'REJECTED',
] as const;

export const humanReviewDecisions = [
  'ACCEPTED',
  'EDITED',
  'REJECTED',
] as const;

export const extractionFactKeys = [
  'documentDate',
  'providerName',
  'providerNpi',
  'payerInsurer',
  'patientName',
  'dateOfBirth',
  'memberPolicyId',
  'requestedEquipment',
  'hcpcsCodes',
  'diagnosisTermsCodes',
  'physicianOrderDetails',
  'evaluationDates',
  'functionalLimitations',
  'evaluationFindings',
  'medicalRationale',
  'requestedAccessories',
  'denialReason',
] as const;

export type DetectedDocumentType = (typeof detectedDocumentTypes)[number];
export type ExtractionConfidence = (typeof extractionConfidences)[number];
export type ExtractionEvidenceStatus =
  (typeof extractionEvidenceStatuses)[number];
export type ExtractionReviewDecision =
  (typeof extractionReviewDecisions)[number];
export type HumanReviewDecision = (typeof humanReviewDecisions)[number];
export type ExtractionFactKey = (typeof extractionFactKeys)[number];

export const extractionFactLabels: Record<ExtractionFactKey, string> = {
  documentDate: 'Document date',
  providerName: 'Provider name',
  providerNpi: 'Provider identifier / NPI',
  payerInsurer: 'Payer / insurer',
  patientName: 'Patient name',
  dateOfBirth: 'Date of birth',
  memberPolicyId: 'Member / policy ID',
  requestedEquipment: 'Requested equipment',
  hcpcsCodes: 'HCPCS codes',
  diagnosisTermsCodes: 'Diagnosis terms / codes',
  physicianOrderDetails: 'Physician order details',
  evaluationDates: 'Evaluation dates',
  functionalLimitations: 'Relevant functional limitations',
  evaluationFindings: 'Relevant evaluation findings',
  medicalRationale: 'Stated medical rationale',
  requestedAccessories: 'Requested accessories / components',
  denialReason: 'Denial reason',
};

export type ExtractedFact = {
  id: string;
  fieldKey: ExtractionFactKey;
  originalValue: string | null;
  confidence: ExtractionConfidence;
  evidenceStatus: ExtractionEvidenceStatus;
  sourceQuote: string | null;
  sourceDocumentId: string;
  uncertaintyNote: string | null;
  reviewDecision: ExtractionReviewDecision;
  reviewedValue: string | null;
  reviewerDisplayName: string | null;
  reviewedAt: string | null;
};

export type DocumentAnalysis = {
  id: string;
  caseId: string;
  documentId: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  provider: string;
  model: string;
  detectedDocumentType: DetectedDocumentType | null;
  classificationConfidence: ExtractionConfidence | null;
  classificationSourceQuote: string | null;
  classificationNeedsReview: boolean;
  warnings: string[];
  requestedByDisplayName: string | null;
  requestedAt: string;
  completedAt: string | null;
  facts: ExtractedFact[];
};

export type ModelExtractedFact = {
  value: string | null;
  confidence: ExtractionConfidence;
  evidenceStatus: ExtractionEvidenceStatus;
  sourceQuote: string | null;
  uncertaintyNote: string | null;
};

export type ModelExtractionOutput = {
  classification: {
    documentType: DetectedDocumentType;
    confidence: ExtractionConfidence;
    sourceQuote: string | null;
    needsReview: boolean;
  };
  warnings: string[];
  facts: Record<ExtractionFactKey, ModelExtractedFact>;
};
