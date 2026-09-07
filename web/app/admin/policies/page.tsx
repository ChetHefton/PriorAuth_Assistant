import { PolicyManagement } from '@/components/admin/policy-management';
import { AppShell } from '@/components/layout/app-shell';
import { countCases } from '@/db/repositories/cases';
import { listPolicies } from '@/db/repositories/policies';
import { requirePermission } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

export default async function PoliciesPage() {
  const currentUser = await requirePermission('policies.manage');
  return (
    <AppShell currentUser={currentUser} activePage="policies" caseCount={countCases()}>
      <PolicyManagement initialPolicies={listPolicies()} />
    </AppShell>
  );
}
