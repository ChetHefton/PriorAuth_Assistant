import type { DocumentAnalysis } from '@/types/extraction';
import type { PriorAuthDraft } from '@/types/prior-auth-draft';
import type { ReadinessEvaluation } from '@/types/policy';
import type { CommunicationRecord, SubmissionDetails, SubmissionPacket } from '@/types/communications';
import type { AppealWorkspace } from '@/types/denial';

export const caseStatuses = [
  'Draft',
  'Needs Documentation',
  'Ready for Submission',
  'Submitted',
  'Pending',
  'Additional Info Requested',
  'Approved',
  'Denied',
  'Appeal Drafting',
  'Appeal Submitted',
  'Closed',
] as const;

export const casePriorities = ['Routine', 'High', 'Urgent'] as const;

export const documentationTypes = [
  'PATIENT_DEMOGRAPHICS',
  'INSURANCE_INFORMATION',
  'PHYSICIAN_ORDER',
  'CLINICAL_CHART_NOTES',
  'PT_OT_EVALUATION',
  'EQUIPMENT_SPECIFICATION',
  'SUPPORTING_DOCUMENTATION',
  'OTHER',
] as const;

export const checklistStatuses = [
  'Received',
  'Missing',
  'Needs Review',
  'Not Required',
] as const;

export const documentReviewStatuses = ['Needs Review', 'Reviewed', 'NOT_ANALYZED', 'ANALYZING', 'REVIEW_COMPLETE', 'NO_ACTION_NEEDED', 'ANALYSIS_FAILED'] as const;

export type CaseStatus = (typeof caseStatuses)[number];
export type CasePriority = (typeof casePriorities)[number];
export type DocumentationType = (typeof documentationTypes)[number];
export type ChecklistStatus = (typeof checklistStatuses)[number];
export type DocumentReviewStatus = (typeof documentReviewStatuses)[number];

export const documentationTypeLabels: Record<DocumentationType, string> = {
  PATIENT_DEMOGRAPHICS: 'Patient demographics',
  INSURANCE_INFORMATION: 'Insurance information',
  PHYSICIAN_ORDER: 'Physician order / prescription',
  CLINICAL_CHART_NOTES: 'Clinical chart notes',
  PT_OT_EVALUATION: 'PT/OT evaluation',
  EQUIPMENT_SPECIFICATION: 'Equipment specification / order details',
  SUPPORTING_DOCUMENTATION: 'Supporting documentation',
  OTHER: 'Other',
};

export type PriorAuthorizationCase = {
  id: string;
  patientName: string;
  patientInitials: string;
  requestedEquipment: string;
  equipmentCategory: string;
  insurer: string;
  insurerPlan: string;
  status: CaseStatus;
  priority: CasePriority;
  assignedSpecialist: string;
  followUpDue: string | null;
  followUpLabel: string;
  isFollowUpDue: boolean;
  missingDocumentationCount: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  lastUpdated: string;
};

export type DocumentationChecklistItem = {
  id: string;
  caseId: string;
  documentType: DocumentationType;
  label: string;
  status: ChecklistStatus;
  sortOrder: number;
  updatedAt: string;
};

export type CaseDocument = {
  id: string;
  caseId: string;
  documentType: DocumentationType;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  uploadedByDisplayName: string;
  uploadedAt: string;
  reviewStatus: DocumentReviewStatus;
  isSynthetic: boolean;
  archivedAt?: string | null;
  analyses: DocumentAnalysis[];
};

export type CaseNote = {
  id: string;
  caseId: string;
  body: string;
  authorDisplayName: string;
  createdAt: string;
};

export type CaseDetail = PriorAuthorizationCase & {
  checklist: DocumentationChecklistItem[];
  documents: CaseDocument[];
  notes: CaseNote[];
  priorAuthDraft: PriorAuthDraft | null;
  readiness: ReadinessEvaluation | null;
  submission?: SubmissionDetails;
  submissionPacket?: SubmissionPacket;
  communications?: CommunicationRecord[];
  appeal?: AppealWorkspace;
};
