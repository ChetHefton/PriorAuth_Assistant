'use client';

import { useMemo, useState } from 'react';
import type { SyntheticEvent } from 'react';
import {
  Check,
  KeyRound,
  LoaderCircle,
  Plus,
  ShieldCheck,
  UserCheck,
  UserRoundCog,
  UserX,
  X,
  RotateCcw,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { roles, type ManagedUser, type UserRole } from '@/types/auth';

const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  AUTHORIZATION_SPECIALIST: 'Authorization Specialist',
  SUPERVISOR: 'Supervisor',
  AUDITOR: 'Auditor',
};

function initials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

type Notice = { tone: 'success' | 'error'; message: string } | null;

export function UserManagement({
  initialUsers,
  currentUserId,
}: {
  initialUsers: ManagedUser[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [userFilter, setUserFilter] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ACTIVE');
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [roleDrafts, setRoleDrafts] = useState<Record<string, UserRole>>(
    Object.fromEntries(initialUsers.map((user) => [user.id, user.role])),
  );
  const [createForm, setCreateForm] = useState({
    username: '',
    displayName: '',
    password: '',
    role: 'AUTHORIZATION_SPECIALIST' as UserRole,
  });

  const activeCount = useMemo(
    () => users.filter((user) => user.isActive).length,
    [users],
  );
  const visibleUsers = useMemo(() => userFilter === 'ALL' ? users : users.filter((user) => user.isActive === (userFilter === 'ACTIVE')), [userFilter, users]);

  async function toggleActive(user: ManagedUser) {
    if (user.isActive && !window.confirm(`Deactivate ${user.displayName}? They will lose login access immediately.`)) return;
    await patchUser(user, { isActive: !user.isActive }, `${user.displayName} is now ${user.isActive ? 'deactivated' : 'active'}.`);
  }

  function replaceUser(updated: ManagedUser) {
    setUsers((current) =>
      current.map((user) => (user.id === updated.id ? updated : user)),
    );
    setRoleDrafts((current) => ({ ...current, [updated.id]: updated.role }));
  }

  async function parseResponse(
    response: Response,
  ): Promise<{ user?: ManagedUser; error?: string }> {
    return response
      .json()
      .catch(() => ({
        error: 'The server returned an invalid response.',
      })) as Promise<{ user?: ManagedUser; error?: string }>;
  }

  async function createUser(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setIsSaving(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const result = await parseResponse(response);
      if (!response.ok || !result.user) {
        setNotice({
          tone: 'error',
          message: result.error ?? 'Unable to create the user.',
        });
        return;
      }

      setUsers((current) =>
        [...current, result.user!].sort((a, b) =>
          a.displayName.localeCompare(b.displayName),
        ),
      );
      setRoleDrafts((current) => ({
        ...current,
        [result.user!.id]: result.user!.role,
      }));
      setCreateForm({
        username: '',
        displayName: '',
        password: '',
        role: 'AUTHORIZATION_SPECIALIST',
      });
      setShowCreateForm(false);
      setNotice({
        tone: 'success',
        message: `${result.user.displayName} can now sign in.`,
      });
    } catch {
      setNotice({
        tone: 'error',
        message: 'Unable to reach the local application.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function patchUser(
    user: ManagedUser,
    changes: Record<string, unknown>,
    successMessage: string,
  ) {
    setNotice(null);
    setBusyUserId(user.id);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      const result = await parseResponse(response);
      if (!response.ok || !result.user) {
        setNotice({
          tone: 'error',
          message: result.error ?? 'Unable to update the user.',
        });
        return false;
      }
      replaceUser(result.user);
      setNotice({ tone: 'success', message: successMessage });
      return true;
    } catch {
      setNotice({
        tone: 'error',
        message: 'Unable to reach the local application.',
      });
      return false;
    } finally {
      setBusyUserId(null);
    }
  }

  async function submitPasswordReset(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetTarget) return;
    const updated = await patchUser(
      resetTarget,
      { password: resetPassword },
      `Password changed for ${resetTarget.displayName}.`,
    );
    if (updated) {
      setResetTarget(null);
      setResetPassword('');
    }
  }

  async function resetDemo() {
    if (!window.confirm('This will restore all synthetic demo cases and remove local test changes. Continue?')) return;
    setNotice(null); setIsSaving(true);
    try {
      const response = await fetch('/api/admin/reset-demo', { method: 'POST', credentials: 'same-origin' });
      const result = await response.json().catch(() => null) as { success?: boolean; message?: string; error?: string } | null;
      setNotice(response.ok && result?.success ? { tone: 'success', message: 'Demo data restored.' } : { tone: 'error', message: result?.error ?? 'Unable to restore demo data.' });
    } catch { setNotice({ tone: 'error', message: 'Unable to reach the local application.' }); } finally { setIsSaving(false); }
  }

  return (
    <main className="mx-auto w-full max-w-[1540px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">
            <UserRoundCog className="size-4" />
            Admin
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-slate-900 sm:text-[28px]">
            User management
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
            Provision internal accounts, assign roles, and manage access to this
            local prototype.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={isSaving} onClick={() => void resetDemo()} className="h-10 rounded-xl border-slate-300 bg-slate-50 px-4 text-slate-700 hover:bg-slate-100"><RotateCcw /> Reset demo data</Button>
        <Button
          onClick={() => setShowCreateForm((visible) => !visible)}
          className="h-10 rounded-xl bg-[#147a6e] px-4 shadow-sm hover:bg-[#116c62]"
        >
          {showCreateForm ? <X /> : <Plus />}
          {showCreateForm ? 'Cancel' : 'Create user'}
        </Button>
        </div>
      </div>

      <section
        aria-label="User summary"
        className="mt-6 grid grid-cols-2 gap-3 lg:max-w-xl"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.025)]">
          <p className="text-[13px] font-medium text-slate-500">
            Provisioned users
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
            {users.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.025)]">
          <p className="text-[13px] font-medium text-slate-500">
            Active accounts
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
            {activeCount}
          </p>
        </div>
      </section>

      {notice ? (
        <output
          className={`mt-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${notice.tone === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-rose-100 bg-rose-50 text-rose-700'}`}
        >
          {notice.tone === 'success' ? (
            <Check className="size-4" />
          ) : (
            <X className="size-4" />
          )}
          {notice.message}
        </output>
      ) : null}

      {showCreateForm ? (
        <section className="mt-5 rounded-2xl border border-teal-100 bg-white p-5 shadow-[0_16px_44px_rgba(15,23,42,0.035)] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
              <UserCheck className="size-[18px]" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">
                Create an internal account
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                The user can sign in immediately after creation.
              </p>
            </div>
          </div>
          <form
            onSubmit={createUser}
            className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <div className="space-y-2">
              <label
                htmlFor="display-name"
                className="text-xs font-semibold text-slate-600"
              >
                Display name
              </label>
              <Input
                id="display-name"
                value={createForm.displayName}
                onChange={(event) =>
                  setCreateForm((form) => ({
                    ...form,
                    displayName: event.target.value,
                  }))
                }
                required
                minLength={2}
                maxLength={100}
                className="h-10 rounded-xl border-slate-200"
                placeholder="Morgan Reed"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="new-username"
                className="text-xs font-semibold text-slate-600"
              >
                Username
              </label>
              <Input
                id="new-username"
                value={createForm.username}
                onChange={(event) =>
                  setCreateForm((form) => ({
                    ...form,
                    username: event.target.value,
                  }))
                }
                required
                minLength={3}
                maxLength={64}
                autoCapitalize="none"
                spellCheck={false}
                className="h-10 rounded-xl border-slate-200"
                placeholder="morgan.reed"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="new-role"
                className="text-xs font-semibold text-slate-600"
              >
                Role
              </label>
              <NativeSelect
                id="new-role"
                value={createForm.role}
                onChange={(event) =>
                  setCreateForm((form) => ({
                    ...form,
                    role: event.target.value as UserRole,
                  }))
                }
                className="w-full [&>select]:h-10 [&>select]:rounded-xl [&>select]:border-slate-200"
              >
                {roles.map((role) => (
                  <NativeSelectOption key={role} value={role}>
                    {roleLabels[role]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="new-password"
                className="text-xs font-semibold text-slate-600"
              >
                Temporary password
              </label>
              <Input
                id="new-password"
                type="password"
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((form) => ({
                    ...form,
                    password: event.target.value,
                  }))
                }
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                className="h-10 rounded-xl border-slate-200"
                placeholder="12+ characters"
              />
            </div>
            <div className="flex items-center justify-between gap-4 md:col-span-2 xl:col-span-4">
              <p className="text-xs text-slate-400">
                Passwords are hashed with Argon2id before storage.
              </p>
              <Button
                type="submit"
                disabled={isSaving}
                className="h-10 bg-[#147a6e] px-4 hover:bg-[#116c62]"
              >
                {isSaving ? <LoaderCircle className="animate-spin" /> : null}
                {isSaving ? 'Creating…' : 'Create account'}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_44px_rgba(15,23,42,0.035)]">
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-center gap-2.5">
            <h2 className="font-semibold text-slate-900">Internal users</h2>
            <Badge variant="secondary" className="bg-slate-100 text-slate-600">{visibleUsers.length}</Badge>
          </div>
          <div className="mt-4 flex items-center gap-2"><span className="text-xs font-semibold text-slate-500">Show</span><NativeSelect aria-label="User status filter" value={userFilter} onChange={(event) => setUserFilter(event.target.value as typeof userFilter)} className="w-[160px] [&>select]:h-9 [&>select]:border-slate-200"><NativeSelectOption value="ACTIVE">Active users</NativeSelectOption><NativeSelectOption value="INACTIVE">Inactive users</NativeSelectOption><NativeSelectOption value="ALL">All users</NativeSelectOption></NativeSelect></div>
          <p className="mt-1 text-xs text-slate-400">
            Account data only. Password hashes and session tokens are never
            returned to this page.
          </p>
        </div>

        <div className="hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow className="h-11 border-slate-100 bg-slate-50/70 hover:bg-slate-50/70">
                <TableHead className="pl-5 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                  User
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                  Role
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                  Status
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                  Created
                </TableHead>
                <TableHead className="pr-5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleUsers.map((user) => {
                const isSelf = user.id === currentUserId;
                const isBusy = busyUserId === user.id;
                return (
                  <TableRow
                    key={user.id}
                    className="h-[76px] border-slate-100 hover:bg-slate-50/70"
                  >
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9 after:border-slate-200">
                          <AvatarFallback className="bg-[#e8f5f2] text-xs font-semibold text-[#167567]">
                            {initials(user.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-slate-800">
                            {user.displayName}
                            {isSelf ? (
                              <span className="ml-1.5 text-xs font-normal text-slate-400">
                                You
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            @{user.username}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <NativeSelect
                          value={roleDrafts[user.id]}
                          disabled={isSelf || isBusy}
                          onChange={(event) =>
                            setRoleDrafts((current) => ({
                              ...current,
                              [user.id]: event.target.value as UserRole,
                            }))
                          }
                          className="w-[190px] [&>select]:h-9 [&>select]:border-slate-200"
                        >
                          {roles.map((role) => (
                            <NativeSelectOption key={role} value={role}>
                              {roleLabels[role]}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                        {roleDrafts[user.id] !== user.role ? (
                          <Button
                            size="sm"
                            disabled={isBusy}
                            onClick={() =>
                              void patchUser(
                                user,
                                { role: roleDrafts[user.id] },
                                `Role updated for ${user.displayName}.`,
                              )
                            }
                          >
                            Save
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-700"
                        >
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          Active
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-slate-200 bg-slate-100 text-slate-600"
                        >
                          <span className="size-1.5 rounded-full bg-slate-400" />
                          Disabled
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell className="pr-5">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isSelf || isBusy}
                          onClick={() => {
                            setResetTarget(user);
                            setResetPassword('');
                          }}
                        >
                          <KeyRound />
                          Password
                        </Button>
                        <Button
                          variant={user.isActive ? 'destructive' : 'outline'}
                          size="sm"
                          disabled={isSelf || isBusy}
                          onClick={() =>
                            void toggleActive(user)
                          }
                        >
                          {isBusy ? (
                            <LoaderCircle className="animate-spin" />
                          ) : user.isActive ? (
                            <UserX />
                          ) : (
                            <UserCheck />
                          )}
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="divide-y divide-slate-100 lg:hidden">
          {visibleUsers.map((user) => {
            const isSelf = user.id === currentUserId;
            const isBusy = busyUserId === user.id;
            return (
              <article key={user.id} className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="size-9 after:border-slate-200">
                    <AvatarFallback className="bg-[#e8f5f2] text-xs font-semibold text-[#167567]">
                      {initials(user.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">
                      {user.displayName}
                      {isSelf ? (
                        <span className="ml-1.5 text-xs font-normal text-slate-400">
                          You
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-400">@{user.username}</p>
                  </div>
                  <div className="ml-auto">
                    {user.isActive ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-slate-200 bg-slate-100 text-slate-600"
                      >
                        Disabled
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <NativeSelect
                    value={roleDrafts[user.id]}
                    disabled={isSelf || isBusy}
                    onChange={(event) =>
                      setRoleDrafts((current) => ({
                        ...current,
                        [user.id]: event.target.value as UserRole,
                      }))
                    }
                    className="w-full [&>select]:h-9 [&>select]:border-slate-200"
                  >
                    {roles.map((role) => (
                      <NativeSelectOption key={role} value={role}>
                        {roleLabels[role]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {roleDrafts[user.id] !== user.role ? (
                    <Button
                      size="sm"
                      disabled={isBusy}
                      onClick={() =>
                        void patchUser(
                          user,
                          { role: roleDrafts[user.id] },
                          `Role updated for ${user.displayName}.`,
                        )
                      }
                    >
                      Save role
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSelf || isBusy}
                    onClick={() => setResetTarget(user)}
                  >
                    <KeyRound />
                    Password
                  </Button>
                  <Button
                    variant={user.isActive ? 'destructive' : 'outline'}
                    size="sm"
                    disabled={isSelf || isBusy}
                    onClick={() =>
                        void toggleActive(user)
                    }
                  >
                    {user.isActive ? <UserX /> : <UserCheck />}
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="mt-5 flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-xs leading-5 text-sky-800">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <p>
          Roles map to granular server-side permissions. Interface visibility is
          not used as the authorization boundary.
        </p>
      </div>

      {resetTarget ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#102a2f]/45 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setResetTarget(null);
          }}
        >
          <dialog
            open
            aria-labelledby="reset-title"
            className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                <KeyRound className="size-[18px]" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close password dialog"
                onClick={() => setResetTarget(null)}
              >
                <X />
              </Button>
            </div>
            <h2
              id="reset-title"
              className="mt-5 text-xl font-semibold tracking-[-0.025em] text-slate-900"
            >
              Change password
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Set a new password for {resetTarget.displayName}. Their existing
              sessions will be signed out.
            </p>
            <form onSubmit={submitPasswordReset} className="mt-5 space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="reset-password"
                  className="text-xs font-semibold text-slate-600"
                >
                  New password
                </label>
                <Input
                  id="reset-password"
                  type="password"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  className="h-10 rounded-xl border-slate-200"
                  placeholder="12+ characters"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResetTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={busyUserId === resetTarget.id}
                  className="bg-[#147a6e] hover:bg-[#116c62]"
                >
                  {busyUserId === resetTarget.id ? (
                    <LoaderCircle className="animate-spin" />
                  ) : null}
                  Change password
                </Button>
              </div>
            </form>
          </dialog>
        </div>
      ) : null}
    </main>
  );
}
