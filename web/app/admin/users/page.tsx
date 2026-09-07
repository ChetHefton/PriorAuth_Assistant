import { UserManagement } from '@/components/admin/user-management';
import { AppShell } from '@/components/layout/app-shell';
import { countCases } from '@/db/repositories/cases';
import { listUsers } from '@/db/repositories/users';
import { requirePermission } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const currentUser = await requirePermission('users.manage');
  const managedUsers = listUsers();
  const caseCount = countCases();

  return (
    <AppShell
      currentUser={currentUser}
      activePage="users"
      caseCount={caseCount}
    >
      <UserManagement
        initialUsers={managedUsers}
        currentUserId={currentUser.id}
      />
    </AppShell>
  );
}
