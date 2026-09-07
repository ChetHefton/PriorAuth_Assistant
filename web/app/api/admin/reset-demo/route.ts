import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/current-user';
import { resetSyntheticDemoData } from '@/db/client';
import { recordAuditEvent } from '@/db/repositories/audit-events';

export async function POST() {
  const user = await requirePermission('users.manage');
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ success: false, error: 'Demo reset is disabled in production.' }, { status: 403 });
  try {
    resetSyntheticDemoData();
    recordAuditEvent({ userId: user.id, action: 'demo.data_reset', resourceType: 'demo_data', resourceId: 'synthetic' });
    return NextResponse.json({ success: true, message: 'Demo data restored.' });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to restore demo data.' }, { status: 500 });
  }
}
