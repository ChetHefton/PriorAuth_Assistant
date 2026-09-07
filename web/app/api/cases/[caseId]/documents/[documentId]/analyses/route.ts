import { NextRequest, NextResponse } from 'next/server';

import { findCaseDocumentRecord } from '@/db/repositories/cases';
import { OpenAIDocumentAnalysisProvider } from '@/lib/ai/openai-document-analysis-provider';
import {
  analyzeDocument,
  DocumentAnalysisServiceError,
} from '@/lib/ai/document-analysis-service';
import { documentIdSchema } from '@/lib/ai/validation';
import {
  isSameOriginRequest,
  requestUserHasPermission,
} from '@/lib/auth/request-authorization';
import { caseIdSchema } from '@/lib/cases/validation';
import {
  DocumentReadError,
  readDocumentText,
} from '@/lib/documents/document-reader';

type RouteContext = {
  params: Promise<{ caseId: string; documentId: string }>;
};

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

  const { caseId, documentId } = await context.params;
  if (
    !caseIdSchema.safeParse(caseId).success ||
    !documentIdSchema.safeParse(documentId).success
  ) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }
  const document = findCaseDocumentRecord(caseId, documentId);
  if (!document) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }

  try {
    const documentText = await readDocumentText(document);
    const provider = new OpenAIDocumentAnalysisProvider();
    const analysis = await analyzeDocument({
      caseId,
      document,
      documentText,
      actorUserId: actor.id,
      provider,
    });
    return NextResponse.json(
      { analysis },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof DocumentReadError) {
      return NextResponse.json({ error: error.message }, { status: 415 });
    }
    if (error instanceof DocumentAnalysisServiceError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    const isConfigurationError =
      error instanceof Error && error.message.includes('OPENAI_API_KEY');
    return NextResponse.json(
      {
        error: isConfigurationError
          ? 'AI analysis is not configured. Add OPENAI_API_KEY to the server environment.'
          : 'AI analysis is temporarily unavailable.',
      },
      { status: isConfigurationError ? 503 : 500 },
    );
  }
}
