import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/current-user';
import { getCaseDetail } from '@/db/repositories/cases';
import { getDenial, saveDenial } from '@/db/repositories/denials';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { compareDenialEvidence } from '@/lib/denials/compare-denial-evidence';
const schema=z.object({denialDocumentId:z.string().nullable().optional(),payer:z.string().trim().min(1).max(160),denialDate:z.string().nullable().optional(),externalReferenceNumber:z.string().max(120).nullable().optional(),denialReasonCode:z.string().max(80).nullable().optional(),denialReasonText:z.string().max(4000).nullable().optional(),appealDeadline:z.string().nullable().optional(),appealInstructions:z.string().max(4000).nullable().optional(),status:z.enum(['OPEN','ANALYZED','APPEAL_PREPARING','CLOSED']).optional()});
export async function GET(_:Request,{params}:{params:Promise<{caseId:string}>}){await requirePermission('cases.read');const {caseId}=await params;const detail=getCaseDetail(caseId);if(!detail)return NextResponse.json({error:'Case not found'},{status:404});const denial=getDenial(caseId);return NextResponse.json({denial,comparison:denial?compareDenialEvidence(denial,detail):null});}
export async function PATCH(req:Request,{params}:{params:Promise<{caseId:string}>}){const user=await requirePermission('cases.write');const {caseId}=await params;const detail=getCaseDetail(caseId);if(!detail)return NextResponse.json({error:'Case not found'},{status:404});const parsed=schema.safeParse(await req.json());if(!parsed.success)return NextResponse.json({error:'Invalid denial data'},{status:400});const denial=saveDenial({caseId,...parsed.data});recordAuditEvent({userId:user.id,action:'denial.record_updated',resourceType:'denial',resourceId:denial.id});return NextResponse.json({denial,comparison:compareDenialEvidence(denial,detail)});}
