import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { priorAuthorizationCases } from '@/db/schema';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { requirePermission } from '@/lib/auth/current-user';

export async function PATCH(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const user = await requirePermission('users.manage');
  const { caseId } = await params;
  const body = await request.json().catch(() => ({})) as { archived?: boolean };
  const archived = body.archived !== false;
  const db = getDatabase();
  const updated = db.update(priorAuthorizationCases).set({ archivedAt: archived ? new Date() : null, archivedByUserId: archived ? user.id : null, updatedAt: new Date() }).where(eq(priorAuthorizationCases.id, caseId)).returning().get();
  if (!updated) return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
  recordAuditEvent({ userId: user.id, action: archived ? 'case.archived' : 'case.restored', resourceType: 'prior_authorization_case', resourceId: caseId }, db);
  return NextResponse.json({ caseId, archived });
}
