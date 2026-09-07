import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/current-user';
import { getCaseDetail } from '@/db/repositories/cases';
import { getDenial } from '@/db/repositories/denials';
import { listCommunications } from '@/db/repositories/communications';
import { OpenAIAppealDraftProvider } from '@/lib/ai/openai-appeal-draft-provider';
import { generateAppeal } from '@/lib/denials/appeal-service';
import { compareDenialEvidence } from '@/lib/denials/compare-denial-evidence';
export async function GET(_:Request,{params}:{params:Promise<{caseId:string}>}){await requirePermission('cases.read');const {caseId}=await params;const detail=getCaseDetail(caseId);const denial=getDenial(caseId);if(!detail)return NextResponse.json({error:'Case not found'},{status:404});return NextResponse.json({denial,comparison:denial?compareDenialEvidence(denial,detail):null,communications:listCommunications(caseId).filter(c=>c.type.startsWith('APPEAL_'))});}
export async function POST(_:Request,{params}:{params:Promise<{caseId:string}>}){const user=await requirePermission('communications.generate');const {caseId}=await params;const detail=getCaseDetail(caseId);const denial=getDenial(caseId);if(!detail||!denial)return NextResponse.json({error:'Denial record is required.'},{status:400});try{await generateAppeal({caseDetail:detail,denial,userId:user.id,provider:new OpenAIAppealDraftProvider()},(await import('@/db/client')).getDatabase());return NextResponse.json({communication:listCommunications(caseId).find(c=>c.type==='APPEAL_LETTER')},{status:201});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to generate appeal'},{status:400});}}
