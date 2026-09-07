import { NextRequest, NextResponse } from 'next/server';

import { getCaseDetail } from '@/db/repositories/cases';
import { OpenAICaseDraftSummaryProvider } from '@/lib/ai/openai-case-draft-summary-provider';
import {
  isSameOriginRequest,
  requestUserHasPermission,
} from '@/lib/auth/request-authorization';
import { caseIdSchema } from '@/lib/cases/validation';
import {
  generatePriorAuthDraft,
  PriorAuthDraftServiceError,
} from '@/lib/drafts/prior-auth-draft-service';

type RouteContext = { params: Promise<{ caseId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
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

  const { caseId } = await context.params;
  if (!caseIdSchema.safeParse(caseId).success) {
    return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
  }
  const caseDetail = getCaseDetail(caseId);
  if (!caseDetail) {
    return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
  }

  try {
    const summaryProvider = new OpenAICaseDraftSummaryProvider();
    const draft = await generatePriorAuthDraft({
      caseId,
      documents: caseDetail.documents,
      trustedCaseData: caseDetail,
      actorUserId: actor.id,
      summaryProvider,
    });
    return NextResponse.json(
      { draft },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof PriorAuthDraftServiceError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    const isConfigurationError =
      error instanceof Error && error.message.includes('OPENAI_API_KEY');
    return NextResponse.json(
      {
        error: isConfigurationError
          ? 'AI draft generation is not configured. Add OPENAI_API_KEY to the server environment.'
          : 'The prior authorization draft could not be generated.',
      },
      { status: isConfigurationError ? 503 : 500 },
    );
  }
}
