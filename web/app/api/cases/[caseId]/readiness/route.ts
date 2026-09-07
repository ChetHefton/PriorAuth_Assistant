import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getCaseDetail } from '@/db/repositories/cases';
import {
  isSameOriginRequest,
  requestUserHasPermission,
} from '@/lib/auth/request-authorization';
import { caseIdSchema } from '@/lib/cases/validation';
import {
  generateReadiness,
  ReadinessServiceError,
} from '@/lib/policies/readiness-service';

const readinessRequestSchema = z
  .object({ policyId: z.uuid().optional() })
  .strict();

type RouteContext = { params: Promise<{ caseId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Request origin could not be verified.' }, { status: 403 });
  }
  const actor = requestUserHasPermission(request, 'cases.write');
  if (!actor) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  const { caseId } = await context.params;
  if (!caseIdSchema.safeParse(caseId).success) {
    return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
  }
  const caseDetail = getCaseDetail(caseId);
  if (!caseDetail) return NextResponse.json({ error: 'Case not found.' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = readinessRequestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: 'The selected policy identifier is invalid.' }, { status: 400 });
  }

  try {
    const evaluation = generateReadiness({
      caseDetail,
      actorUserId: actor.id,
      manualPolicyId: parsed.data.policyId,
    });
    return NextResponse.json(
      { evaluation },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof ReadinessServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.code === 'POLICY_NOT_FOUND' ? 404 : 400 });
    }
    return NextResponse.json({ error: 'Readiness could not be evaluated.' }, { status: 500 });
  }
}
