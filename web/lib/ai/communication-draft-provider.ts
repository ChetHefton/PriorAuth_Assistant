import type { CommunicationDraft } from '@/lib/ai/communication-draft-schema';
import type { CommunicationType, SubmissionPacket } from '@/types/communications';
export interface CommunicationDraftProvider { readonly modelName:string; generate(input:{type:CommunicationType; packet:SubmissionPacket; purpose:string}):Promise<CommunicationDraft>; }
