import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDatabase } from '@/db/client';
import { caseDocuments, documentAnalyses } from '@/db/schema';
import { findCaseDocumentRecord } from '@/db/repositories/cases';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { requirePermission } from '@/lib/auth/current-user';

export async function DELETE(_: Request, { params }: { params: Promise<{ caseId: string; documentId: string }> }) {
  const user = await requirePermission('cases.write');
  const { caseId, documentId } = await params;
  const db = getDatabase();
  const doc = findCaseDocumentRecord(caseId, documentId, db);
  if (!doc) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  const analyzed = Boolean(db.select({ id: documentAnalyses.id }).from(documentAnalyses).where(eq(documentAnalyses.documentId, documentId)).get());
  if (analyzed) {
    db.update(caseDocuments).set({ archivedAt: new Date(), archivedByUserId: user.id }).where(and(eq(caseDocuments.id, documentId), eq(caseDocuments.caseId, caseId))).run();
    recordAuditEvent({ userId: user.id, action: 'case.document_archived', resourceType: 'case_document', resourceId: documentId }, db);
    return NextResponse.json({ archived: true });
  }
  db.delete(caseDocuments).where(and(eq(caseDocuments.id, documentId), eq(caseDocuments.caseId, caseId))).run();
  const storedPath = doc.storedFilename.startsWith('data/local/') ? path.join(/* turbopackIgnore: true */ process.cwd(), doc.storedFilename) : path.join(process.cwd(), 'data', 'local', 'uploads', doc.storedFilename);
  await unlink(storedPath).catch(() => undefined);
  recordAuditEvent({ userId: user.id, action: 'case.document_deleted', resourceType: 'case_document', resourceId: documentId }, db);
  return NextResponse.json({ deleted: true });
}
