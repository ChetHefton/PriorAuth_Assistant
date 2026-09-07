import { NextRequest, NextResponse } from 'next/server';

import { findCaseRecord } from '@/db/repositories/cases';
import {
  isSameOriginRequest,
  requestUserHasPermission,
} from '@/lib/auth/request-authorization';
import { addCaseNoteSchema, caseIdSchema } from '@/lib/cases/validation';
import { createCaseNote } from '@/lib/cases/workflow-service';

type RouteContext = { params: Promise<{ caseId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
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
  const parsed = addCaseNoteSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid note.' },
      { status: 400 },
    );
  }

  const note = createCaseNote(caseId, parsed.data.body, actor.id);
  return NextResponse.json(
    { note },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  );
}
