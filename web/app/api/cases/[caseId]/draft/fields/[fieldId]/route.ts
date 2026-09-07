import { NextRequest, NextResponse } from 'next/server';

import {
  isSameOriginRequest,
  requestUserHasPermission,
} from '@/lib/auth/request-authorization';
import { caseIdSchema } from '@/lib/cases/validation';
import {
  PriorAuthDraftServiceError,
  saveVerifiedDraftValue,
} from '@/lib/drafts/prior-auth-draft-service';
import {
  draftFieldIdSchema,
  updateDraftFieldSchema,
} from '@/lib/drafts/validation';

type RouteContext = {
  params: Promise<{ caseId: string; fieldId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: 'Request origin could not be verified.' },
      { status: 403 },
    );
  }
  const actor = requestUserHasPermission(request, 'cases.write');
  if (!actor) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { caseId, fieldId } = await context.params;
  if (
    !caseIdSchema.safeParse(caseId).success ||
    !draftFieldIdSchema.safeParse(fieldId).success
  ) {
    return NextResponse.json({ error: 'Draft field not found.' }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const parsed = updateDraftFieldSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Enter a value of 2,000 characters or fewer.' },
      { status: 400 },
    );
  }

  try {
    const draft = saveVerifiedDraftValue({
      caseId,
      fieldId,
      value: parsed.data.value,
      actorUserId: actor.id,
    });
    return NextResponse.json(
      { draft },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof PriorAuthDraftServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'DRAFT_FIELD_NOT_FOUND' ? 404 : 400 },
      );
    }
    return NextResponse.json(
      { error: 'Unable to save the verified draft value.' },
      { status: 500 },
    );
  }
}
