import type { CaseStatus } from '@/types/case';

export const communicationTypes = ['AUTHORIZATION_REQUEST','INITIAL_SUBMISSION_EMAIL','FOLLOW_UP_EMAIL','FAX_COVER','PHONE_SCRIPT','ADDITIONAL_INFO_RESPONSE','APPEAL_LETTER','APPEAL_FAX_COVER','APPEAL_FOLLOW_UP_EMAIL','APPEAL_FOLLOW_UP_PHONE'] as const;
export type CommunicationType = (typeof communicationTypes)[number];
export type CommunicationChannel = 'EMAIL' | 'FAX' | 'PHONE';
export type CommunicationStatus = 'DRAFT' | 'REVIEWED' | 'USED' | 'DISCARDED';
export type SubmissionDetails = {
  status: CaseStatus; submittedAt: string | null; submissionChannel: string | null;
  externalReferenceNumber: string | null; lastFollowUpAt: string | null; nextFollowUpAt: string | null;
  submittedByDisplayName: string | null; isFollowUpDue: boolean;
};
export type SubmissionPacket = {
  patient: Record<string,string>; provider: Record<string,string>; insurance: Record<string,string>;
  request: Record<string,string>; supportingDocuments: string[]; unresolvedItems: string[];
  policy: { name:string; version:string; effectiveDate:string; sourceReference:string; submissionChannel:string; isSynthetic:boolean } | null;
  readinessStatus: string; readyForPreparation: boolean;
};
export type CommunicationRecord = {
  id:string; caseId:string; type:CommunicationType; channel:CommunicationChannel; purpose:string;
  generatedContent:{subject?:string; body:string; notes?:string[]}; editedContent:{subject?:string; body:string; notes?:string[]} | null;
  generatedByDisplayName:string; reviewedByDisplayName:string|null; status:CommunicationStatus; createdAt:string; updatedAt:string;
};
