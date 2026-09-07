import { NextRequest, NextResponse } from 'next/server';

import { findCaseRecord } from '@/db/repositories/cases';
import {
  isSameOriginRequest,
  requestUserHasPermission,
} from '@/lib/auth/request-authorization';
import { caseIdSchema, updateCaseStatusSchema } from '@/lib/cases/validation';
import { changeCaseStatus } from '@/lib/cases/workflow-service';

type RouteContext = { params: Promise<{ caseId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: 'Request origin could not be verified.' },
      { status: 403 },
    );
  }
  const actor = requestUserHasPermission(request, 'cases.write');
  if (!actor)
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  const { caseId } = await context.params;
  if (!caseIdSchema.safeParse(caseId).success || !findCaseRecord(caseId)) {
    return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
  }
  const parsed = updateCaseStatusSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Select a valid authorization status.' },
      { status: 400 },
    );
  }

  const updated = changeCaseStatus(caseId, parsed.data.status, actor.id);
  if (!updated)
    return NextResponse.json({ error: 'Case not found.' }, { status: 404 });

  return NextResponse.json(
    { status: updated.status, updatedAt: updated.updatedAt.toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
