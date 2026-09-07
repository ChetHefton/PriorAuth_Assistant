import { notFound } from 'next/navigation';

import { CaseDetail } from '@/components/cases/case-detail';
import { AppShell } from '@/components/layout/app-shell';
import { countCases, getCaseDetail } from '@/db/repositories/cases';
import { listActivePolicyOptions } from '@/db/repositories/policies';
import { requirePermission } from '@/lib/auth/current-user';
import { caseIdSchema } from '@/lib/cases/validation';

export const dynamic = 'force-dynamic';

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const currentUser = await requirePermission('cases.read');
  const { caseId } = await params;
  if (!caseIdSchema.safeParse(caseId).success) notFound();

  const caseDetail = getCaseDetail(caseId);
  if (!caseDetail) notFound();

  return (
    <AppShell
      currentUser={currentUser}
      activePage="case"
      caseCount={countCases()}
    >
      <CaseDetail
        initialCase={caseDetail}
        canWrite={currentUser.permissions.includes('cases.write')}
        canManageCases={currentUser.permissions.includes('users.manage')}
        canGenerateCommunications={currentUser.permissions.includes('communications.generate')}
        policyOptions={listActivePolicyOptions()}
      />
    </AppShell>
  );
}
