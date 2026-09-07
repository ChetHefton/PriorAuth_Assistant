import { NextRequest, NextResponse } from 'next/server';

import {
  DocumentAnalysisServiceError,
  reviewFact,
} from '@/lib/ai/document-analysis-service';
import {
  analysisIdSchema,
  documentIdSchema,
  factIdSchema,
  reviewFactSchema,
} from '@/lib/ai/validation';
import {
  isSameOriginRequest,
  requestUserHasPermission,
} from '@/lib/auth/request-authorization';
import { caseIdSchema } from '@/lib/cases/validation';

type RouteContext = {
  params: Promise<{
    caseId: string;
    documentId: string;
    analysisId: string;
    factId: string;
  }>;
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

  const params = await context.params;
  if (
    !caseIdSchema.safeParse(params.caseId).success ||
    !documentIdSchema.safeParse(params.documentId).success ||
    !analysisIdSchema.safeParse(params.analysisId).success ||
    !factIdSchema.safeParse(params.factId).success
  ) {
    return NextResponse.json(
      { error: 'Extracted fact not found.' },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = reviewFactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid review decision.' },
      { status: 400 },
    );
  }

  try {
    const analysis = reviewFact({
      ...params,
      ...parsed.data,
      actorUserId: actor.id,
    });
    return NextResponse.json(
      { analysis },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof DocumentAnalysisServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'FACT_NOT_FOUND' ? 404 : 400 },
      );
    }
    return NextResponse.json(
      { error: 'Unable to save the review decision.' },
      { status: 500 },
    );
  }
}
