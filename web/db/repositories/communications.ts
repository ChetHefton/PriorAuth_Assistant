import { randomUUID } from 'node:crypto';
import { and, desc, eq, ne } from 'drizzle-orm';
import { getDatabase, type DatabaseClient } from '@/db/client';
import { caseCommunications, priorAuthorizationCases, users } from '@/db/schema';
import type { CommunicationRecord, CommunicationType, CommunicationChannel, CommunicationStatus, SubmissionDetails } from '@/types/communications';
import type { CaseStatus } from '@/types/case';

const parse = (v:string) => JSON.parse(v) as {subject?:string;body:string;notes?:string[]};
export function getSubmissionDetails(caseId:string, db:DatabaseClient=getDatabase()): SubmissionDetails {
  const row=db.select({c:priorAuthorizationCases,u:users.displayName}).from(priorAuthorizationCases).leftJoin(users,eq(priorAuthorizationCases.submittedByUserId,users.id)).where(eq(priorAuthorizationCases.id,caseId)).get();
  if(!row) throw new Error('Case not found'); const now=Date.now(); const due=row.c.nextFollowUpAt ? row.c.nextFollowUpAt.getTime()<=now : false;
  return {status:row.c.status,submittedAt:row.c.submittedAt?.toISOString()??null,submissionChannel:row.c.submissionChannel,externalReferenceNumber:row.c.externalReferenceNumber,lastFollowUpAt:row.c.lastFollowUpAt?.toISOString()??null,nextFollowUpAt:row.c.nextFollowUpAt?.toISOString()??null,submittedByDisplayName:row.u,isFollowUpDue:due};
}
export function updateSubmissionDetails(caseId:string,input:{status?:CaseStatus;submissionChannel?:string|null;externalReferenceNumber?:string|null;submittedAt?:Date|null;lastFollowUpAt?:Date|null;nextFollowUpAt?:Date|null;submittedByUserId?:string|null},db:DatabaseClient=getDatabase()){ return db.update(priorAuthorizationCases).set({...input,updatedAt:new Date()}).where(eq(priorAuthorizationCases.id,caseId)).returning().get(); }
export function listCommunications(caseId:string,db:DatabaseClient=getDatabase(),includeDiscarded = false):CommunicationRecord[]{ const where=includeDiscarded?eq(caseCommunications.caseId,caseId):and(eq(caseCommunications.caseId,caseId),ne(caseCommunications.status,'DISCARDED')); return db.select({c:caseCommunications,g:users.displayName,r:users.displayName}).from(caseCommunications).leftJoin(users,eq(caseCommunications.generatedByUserId,users.id)).where(where).orderBy(desc(caseCommunications.createdAt)).all().map(({c,g})=>({id:c.id,caseId:c.caseId,type:c.type,channel:c.channel,purpose:c.purpose,generatedContent:parse(c.generatedContent),editedContent:c.editedContent?parse(c.editedContent):null,generatedByDisplayName:g??'Unknown',reviewedByDisplayName:null,status:c.status,createdAt:c.createdAt.toISOString(),updatedAt:c.updatedAt.toISOString()})); }
export function createCommunication(input:{caseId:string;type:CommunicationType;channel:CommunicationChannel;purpose:string;generatedContent:{subject?:string;body:string;notes?:string[]};userId:string},db:DatabaseClient=getDatabase()){const now=new Date(); return db.insert(caseCommunications).values({id:randomUUID(),caseId:input.caseId,type:input.type,channel:input.channel,purpose:input.purpose,generatedContent:JSON.stringify(input.generatedContent),generatedByUserId:input.userId,status:'DRAFT',createdAt:now,updatedAt:now}).returning().get();}
export function updateCommunication(id:string,input:{editedContent?:{subject?:string;body:string;notes?:string[]}|null;status?:CommunicationStatus;reviewedByUserId?:string|null},db:DatabaseClient=getDatabase()){return db.update(caseCommunications).set({...input,editedContent:input.editedContent===undefined?undefined:input.editedContent?JSON.stringify(input.editedContent):null,updatedAt:new Date()}).where(eq(caseCommunications.id,id)).returning().get();}
export function deleteCommunication(caseId:string,id:string,db:DatabaseClient=getDatabase()): { status: CommunicationStatus } | null {
  const existing=db.select({status:caseCommunications.status}).from(caseCommunications).where(and(eq(caseCommunications.id,id),eq(caseCommunications.caseId,caseId))).get();
  if(!existing || !['DRAFT','DISCARDED'].includes(existing.status)) return null;
  db.delete(caseCommunications).where(and(eq(caseCommunications.id,id),eq(caseCommunications.caseId,caseId))).run();
  return existing;
}
