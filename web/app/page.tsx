import { DashboardApp } from '@/components/dashboard/dashboard-app';
import { listCases } from '@/db/repositories/cases';
import { requirePermission } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const currentUser = await requirePermission('cases.read');
  const cases = listCases(undefined, true);
  return <DashboardApp currentUser={currentUser} cases={cases} />;
}
