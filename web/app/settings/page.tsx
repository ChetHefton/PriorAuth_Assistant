import { AppShell } from '@/components/layout/app-shell';
import { SettingsPreferences } from '@/components/settings/settings-preferences';
import { countCases } from '@/db/repositories/cases';
import { requirePermission } from '@/lib/auth/current-user';
export const dynamic='force-dynamic';
export default async function SettingsPage(){const user=await requirePermission('cases.read');return <AppShell currentUser={user} activePage="settings" caseCount={countCases()}><main className="mx-auto max-w-[920px] px-4 py-8 sm:px-6 lg:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace preferences</p><h1 className="mt-2 text-3xl font-semibold text-slate-950">Settings</h1><p className="mt-2 text-sm text-slate-600">Tune readability and interface density for this browser.</p><div className="mt-8"><SettingsPreferences /></div></main></AppShell>}
