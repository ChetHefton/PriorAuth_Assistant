import type { DatabaseClient } from '@/db/client';
import { createCommunication, deleteCommunication } from '@/db/repositories/communications';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import type { CaseDetail } from '@/types/case';
import type { CommunicationDraftProvider } from '@/lib/ai/communication-draft-provider';
import type { CommunicationChannel, CommunicationType } from '@/types/communications';
import { buildSubmissionPacket } from '@/lib/submissions/build-submission-packet';
export async function generateCommunication(input:{caseDetail:CaseDetail;type:CommunicationType;channel:CommunicationChannel;purpose:string;userId:string;provider:CommunicationDraftProvider},db:DatabaseClient){const draft=await input.provider.generate({type:input.type,purpose:input.purpose,packet:buildSubmissionPacket(input.caseDetail)});const row=createCommunication({caseId:input.caseDetail.id,type:input.type,channel:input.channel,purpose:input.purpose,generatedContent:draft,userId:input.userId},db);recordAuditEvent({userId:input.userId,action:'communication.generated',resourceType:'case_communication',resourceId:row.id},db);return row;}
export function deleteCommunicationDraft(input:{caseId:string;communicationId:string;userId:string},db:DatabaseClient): boolean { const deleted=deleteCommunication(input.caseId,input.communicationId,db); if(!deleted)return false; recordAuditEvent({userId:input.userId,action:'communication.deleted',resourceType:'case_communication',resourceId:input.communicationId},db); return true; }
