import { NextRequest, NextResponse } from 'next/server';

import { getPolicy, savePolicy } from '@/db/repositories/policies';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import {
  isSameOriginRequest,
  requestUserHasPermission,
} from '@/lib/auth/request-authorization';
import { policyIdSchema, policyInputSchema } from '@/lib/policies/validation';

type RouteContext = { params: Promise<{ policyId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Request origin could not be verified.' }, { status: 403 });
  }
  const actor = requestUserHasPermission(request, 'policies.manage');
  if (!actor) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  const { policyId } = await context.params;
  if (!policyIdSchema.safeParse(policyId).success || !getPolicy(policyId)) {
    return NextResponse.json({ error: 'Policy not found.' }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const parsed = policyInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Policy details are invalid.' }, { status: 400 });
  try {
    const previous = getPolicy(policyId)!;
    const policy = savePolicy({ ...parsed.data, policyId });
    recordAuditEvent({
      userId: actor.id,
      action: previous.isActive !== policy.isActive ? 'policy.activation_changed' : 'policy.updated',
      resourceType: 'payer_policy',
      resourceId: policy.id,
    });
    return NextResponse.json({ policy }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to update the policy.' }, { status: 400 });
  }
}
