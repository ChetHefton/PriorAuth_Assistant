import { NextRequest, NextResponse } from 'next/server';

import { findCaseRecord } from '@/db/repositories/cases';
import {
  isSameOriginRequest,
  requestUserHasPermission,
} from '@/lib/auth/request-authorization';
import { caseIdSchema, documentTypeSchema } from '@/lib/cases/validation';
import { registerCaseDocument } from '@/lib/cases/workflow-service';
import { MAX_MULTIPART_BYTES } from '@/lib/documents/config';
import type { CaseDocument } from '@/types/case';
import {
  DocumentUploadError,
  removeStoredDocument,
  validateAndStoreDocument,
} from '@/lib/documents/local-storage';

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

  const contentLength = Number.parseInt(
    request.headers.get('content-length') ?? '',
    10,
  );
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) {
    return NextResponse.json(
      { error: 'Documents must be 10 MB or smaller.' },
      { status: 413 },
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData)
    return NextResponse.json(
      { error: 'Invalid upload request.' },
      { status: 400 },
    );

  const files = formData.getAll('file').filter((value): value is File => value instanceof File);
  const documentType = documentTypeSchema.safeParse(
    formData.get('documentType'),
  );
  if (!files.length || !documentType.success) {
    return NextResponse.json(
      { error: 'Choose a document and document type.' },
      { status: 400 },
    );
  }

  const results: Array<{ document?: CaseDocument; error?: string; filename: string }> = [];
  for (const file of files) { let stored: Awaited<ReturnType<typeof validateAndStoreDocument>> | null = null; try { stored = await validateAndStoreDocument(file); const document = registerCaseDocument({ ...stored, caseId, documentType: documentType.data }, actor.id); results.push({ document, filename: file.name }); } catch (error) { if (stored) await removeStoredDocument(stored.storedFilename); results.push({ filename: file.name, error: error instanceof DocumentUploadError ? error.message : 'Unable to store the document.' }); } }
  const documents = results.flatMap((result) => result.document ? [result.document] : []);
  return NextResponse.json(
      { documents, results },
      { status: documents.length ? 201 : 400, headers: { 'Cache-Control': 'no-store' } },
    );
}
