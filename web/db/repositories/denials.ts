import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { getDatabase, type DatabaseClient } from '@/db/client';
import { denialRecords } from '@/db/schema';
import type { DenialRecord } from '@/types/denial';
function dto(r:typeof denialRecords.$inferSelect):DenialRecord{return {...r,denialDate:r.denialDate,createdAt:r.createdAt.toISOString(),updatedAt:r.updatedAt.toISOString()};}
export function getDenial(caseId:string,db:DatabaseClient=getDatabase()){const r=db.select().from(denialRecords).where(eq(denialRecords.caseId,caseId)).orderBy(desc(denialRecords.updatedAt)).get();return r?dto(r):null;}
export function saveDenial(input:{caseId:string;denialDocumentId?:string|null;payer:string;denialDate?:string|null;externalReferenceNumber?:string|null;denialReasonCode?:string|null;denialReasonText?:string|null;appealDeadline?:string|null;appealInstructions?:string|null;status?:'OPEN'|'ANALYZED'|'APPEAL_PREPARING'|'CLOSED'},db:DatabaseClient=getDatabase()){const now=new Date();const existing=db.select().from(denialRecords).where(eq(denialRecords.caseId,input.caseId)).get();const values={...input,updatedAt:now};if(existing)return dto(db.update(denialRecords).set(values).where(eq(denialRecords.id,existing.id)).returning().get());return dto(db.insert(denialRecords).values({id:randomUUID(),...input,status:input.status??'OPEN',createdAt:now,updatedAt:now}).returning().get());}
