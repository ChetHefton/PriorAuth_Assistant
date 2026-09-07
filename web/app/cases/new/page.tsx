import { AppShell } from '@/components/layout/app-shell';
import { NewCaseIntake } from '@/components/cases/new-case-intake';
import { countCases } from '@/db/repositories/cases';
import { requirePermission } from '@/lib/auth/current-user';
export const dynamic='force-dynamic';
export default async function NewCasePage(){const user=await requirePermission('cases.write');return <AppShell currentUser={user} activePage="case" caseCount={countCases()}><main className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 lg:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">New patient / case</p><h1 className="mt-2 text-3xl font-semibold text-slate-950">Create a prior authorization case</h1><p className="mt-2 text-sm text-slate-600">Upload a synthetic document dump, review grounded proposals, then create the case.</p><NewCaseIntake /></main></AppShell>}
