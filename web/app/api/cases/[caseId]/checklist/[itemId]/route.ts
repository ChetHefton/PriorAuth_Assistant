import { NextRequest, NextResponse } from 'next/server';

import { findCaseRecord } from '@/db/repositories/cases';
import {
  isSameOriginRequest,
  requestUserHasPermission,
} from '@/lib/auth/request-authorization';
import {
  caseIdSchema,
  checklistItemIdSchema,
  updateChecklistStatusSchema,
} from '@/lib/cases/validation';
import { changeChecklistStatus } from '@/lib/cases/workflow-service';

type RouteContext = { params: Promise<{ caseId: string; itemId: string }> };

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

  const { caseId, itemId } = await context.params;
  if (
    !caseIdSchema.safeParse(caseId).success ||
    !checklistItemIdSchema.safeParse(itemId).success ||
    !findCaseRecord(caseId)
  ) {
    return NextResponse.json(
      { error: 'Checklist item not found.' },
      { status: 404 },
    );
  }
  const parsed = updateChecklistStatusSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Select a valid checklist state.' },
      { status: 400 },
    );
  }

  const item = changeChecklistStatus(
    caseId,
    itemId,
    parsed.data.status,
    actor.id,
  );
  if (!item)
    return NextResponse.json(
      { error: 'Checklist item not found.' },
      { status: 404 },
    );

  return NextResponse.json(
    { item },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
