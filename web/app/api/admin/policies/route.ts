import { NextRequest, NextResponse } from 'next/server';

import {
  listPolicies,
  savePolicy,
} from '@/db/repositories/policies';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import {
  isSameOriginRequest,
  requestUserHasPermission,
} from '@/lib/auth/request-authorization';
import { policyInputSchema } from '@/lib/policies/validation';

export async function GET(request: NextRequest) {
  const actor = requestUserHasPermission(request, 'policies.manage');
  if (!actor) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  return NextResponse.json({ policies: listPolicies() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Request origin could not be verified.' }, { status: 403 });
  }
  const actor = requestUserHasPermission(request, 'policies.manage');
  if (!actor) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = policyInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Policy details are invalid.' }, { status: 400 });
  try {
    const policy = savePolicy(parsed.data);
    recordAuditEvent({
      userId: actor.id,
      action: 'policy.created',
      resourceType: 'payer_policy',
      resourceId: policy.id,
    });
    return NextResponse.json({ policy }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to save the policy.' }, { status: 400 });
  }
}
