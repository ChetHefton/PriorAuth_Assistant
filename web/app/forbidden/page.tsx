import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { countCases } from '@/db/repositories/cases';
import { requireCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

export default async function ForbiddenPage() {
  const currentUser = await requireCurrentUser();
  const caseCount = countCases();

  return (
    <AppShell
      currentUser={currentUser}
      activePage="dashboard"
      caseCount={caseCount}
    >
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_16px_44px_rgba(15,23,42,0.05)]">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
            <ShieldAlert className="size-5" />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-[-0.025em] text-slate-900">
            Access not available
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Your role does not include permission to view this area.
          </p>
          <Button
            render={<Link href="/" />}
            className="mt-6 bg-[#147a6e] hover:bg-[#116c62]"
          >
            <ArrowLeft />
            Return to dashboard
          </Button>
        </div>
      </main>
    </AppShell>
  );
}
