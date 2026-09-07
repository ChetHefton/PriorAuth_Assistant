import { NextResponse } from 'next/server';

import { getDatabase } from '@/db/client';
import { deleteCasePermanently } from '@/lib/cases/delete-service';
import { requirePermission } from '@/lib/auth/current-user';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const user = await requirePermission('users.manage');
  const { caseId } = await params;
  const deleted = await deleteCasePermanently({ db: getDatabase(), caseId, userId: user.id });
  if (!deleted) return NextResponse.json({ success: false, error: 'Case not found.' }, { status: 404 });
  return NextResponse.json({ success: true, caseId });
}
