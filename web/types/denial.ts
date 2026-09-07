import type { CommunicationRecord } from '@/types/communications';
export const denialStatuses=['OPEN','ANALYZED','APPEAL_PREPARING','CLOSED'] as const;
export type DenialStatus=(typeof denialStatuses)[number];
export const appealStatuses=['DENIED','APPEAL_PREPARING','APPEAL_NEEDS_DOCUMENTATION','APPEAL_READY','APPEAL_SUBMITTED','APPEAL_PENDING','APPEAL_APPROVED','APPEAL_DENIED','CLOSED'] as const;
export type AppealStatus=(typeof appealStatuses)[number];
export type DenialRecord={id:string;caseId:string;denialDocumentId:string|null;payer:string;denialDate:string|null;externalReferenceNumber:string|null;denialReasonCode:string|null;denialReasonText:string|null;appealDeadline:string|null;appealInstructions:string|null;status:DenialStatus;createdAt:string;updatedAt:string};
export type DenialFinding={status:'EVIDENCE_GAP_CONFIRMED'|'EVIDENCE_ALREADY_PRESENT'|'POTENTIAL_SUBMISSION_DISCREPANCY'|'ADDITIONAL_DOCUMENTATION_REQUIRED'|'POLICY_REQUIREMENT_UNCLEAR'|'HUMAN_REVIEW_REQUIRED';label:string;reason:string;sourceDocumentIds:string[]};
export type AppealReadiness='READY_TO_DRAFT'|'MISSING_SUPPORTING_INFORMATION'|'NEEDS_HUMAN_REVIEW';
export type AppealWorkspace={denial:DenialRecord|null;findings:DenialFinding[];readiness:AppealReadiness;nextAction:string;communications:CommunicationRecord[]};
