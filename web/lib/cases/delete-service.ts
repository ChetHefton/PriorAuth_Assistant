import { rm } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';

import type { DatabaseClient } from '@/db/client';
import { caseDocuments, caseIntakes, priorAuthorizationCases } from '@/db/schema';
import { recordAuditEvent } from '@/db/repositories/audit-events';

export async function deleteCasePermanently(input: {
  db: DatabaseClient;
  caseId: string;
  userId: string;
}): Promise<boolean> {
  const record = input.db.select({ id: priorAuthorizationCases.id }).from(priorAuthorizationCases).where(eq(priorAuthorizationCases.id, input.caseId)).get();
  if (!record) return false;
  const documents = input.db.select({ storedFilename: caseDocuments.storedFilename }).from(caseDocuments).where(eq(caseDocuments.caseId, input.caseId)).all();
  const intakes = input.db.select({ id: caseIntakes.id }).from(caseIntakes).where(eq(caseIntakes.createdCaseId, input.caseId)).all();
  recordAuditEvent({ userId: input.userId, action: 'case.deleted', resourceType: 'prior_authorization_case', resourceId: input.caseId }, input.db);
  input.db.transaction((transaction) => {
    transaction.delete(caseIntakes).where(eq(caseIntakes.createdCaseId, input.caseId)).run();
    transaction.delete(priorAuthorizationCases).where(eq(priorAuthorizationCases.id, input.caseId)).run();
  });
  await Promise.all(documents.map((document) => rm(path.join(process.cwd(), 'data', 'local', 'uploads', path.basename(document.storedFilename)), { force: true })));
  await Promise.all(intakes.map((intake) => rm(path.join(process.cwd(), 'data', 'local', 'intakes', intake.id), { recursive: true, force: true })));
  return true;
}
