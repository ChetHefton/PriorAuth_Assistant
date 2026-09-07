import type { DatabaseClient } from '@/db/client';
import { createCommunication } from '@/db/repositories/communications';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import type { CaseDetail } from '@/types/case';
import type { DenialRecord } from '@/types/denial';
import type { OpenAIAppealDraftProvider } from '@/lib/ai/openai-appeal-draft-provider';
export async function generateAppeal(input:{caseDetail:CaseDetail;denial:DenialRecord;userId:string;provider:OpenAIAppealDraftProvider},db:DatabaseClient){const draft=await input.provider.generate(input.denial,input.caseDetail);const row=createCommunication({caseId:input.caseDetail.id,type:'APPEAL_LETTER',channel:'FAX',purpose:'Appeal letter',generatedContent:{subject:draft.subject,body:draft.body,notes:draft.evidenceReferences},userId:input.userId},db);recordAuditEvent({userId:input.userId,action:'appeal.draft_generated',resourceType:'case_communication',resourceId:row.id},db);return row;}
