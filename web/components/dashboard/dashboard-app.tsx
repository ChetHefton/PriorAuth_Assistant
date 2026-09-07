'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileStack,
  Search,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';

import { AppShell } from '@/components/layout/app-shell';
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
import { cn } from '@/lib/utils';
import type { AppUser } from '@/types/auth';
import {
  caseStatuses,
  type CaseStatus,
  type PriorAuthorizationCase,
} from '@/types/case';

const statusStyles: Record<CaseStatus, string> = {
  Draft: 'border-slate-200 bg-slate-100 text-slate-700',
  'Needs Documentation': 'border-amber-200 bg-amber-50 text-amber-800',
  'Ready for Submission': 'border-blue-200 bg-blue-50 text-blue-800',
  Submitted: 'border-sky-200 bg-sky-50 text-sky-800',
  Pending: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  Approved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Denied: 'border-rose-200 bg-rose-50 text-rose-800',
  'Appeal Drafting': 'border-violet-200 bg-violet-50 text-violet-800',
  'Additional Info Requested': 'border-orange-200 bg-orange-50 text-orange-800',
  'Appeal Submitted': 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800',
  Closed: 'border-slate-200 bg-slate-100 text-slate-600',
};

function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn('h-6 px-2.5 font-semibold', statusStyles[status])}
    >
      <span className="size-1.5 rounded-full bg-current opacity-75" />
      {status}
    </Badge>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof ClipboardCheck;
  tone: 'teal' | 'amber' | 'blue' | 'rose';
}) {
  const tones = {
    teal: 'bg-blue-50 text-blue-700 ring-blue-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    blue: 'bg-sky-50 text-sky-700 ring-sky-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  };

  return (
    <article className="rounded-2xl border border-slate-300/80 bg-slate-50 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.035)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
            {value}
          </p>
        </div>
        <div
          className={cn(
            'grid size-10 place-items-center rounded-xl ring-1',
            tones[tone],
          )}
        >
          <Icon className="size-[18px]" strokeWidth={2} />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

function CaseRow({ caseItem }: { caseItem: PriorAuthorizationCase }) {
  return (
    <TableRow
      className="group h-[74px] cursor-pointer border-slate-100 hover:bg-slate-50/70"
      tabIndex={0}
      aria-label={`Open case ${caseItem.id}`}
      onClick={() => { window.location.href = `/cases/${caseItem.id}`; }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          window.location.href = `/cases/${caseItem.id}`;
        }
      }}
    >
      <TableCell className="pl-5">
        <Link
          href={`/cases/${caseItem.id}`}
          className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Avatar className="size-9 after:border-slate-200">
            <AvatarFallback className="bg-[#e8f5f2] text-xs font-semibold text-[#167567]">
              {caseItem.patientInitials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-slate-800">
              {caseItem.patientName}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-400">
              {caseItem.id}
            </p>
          </div>
        </Link>
      </TableCell>
      <TableCell>
        <p className="max-w-[230px] truncate font-medium text-slate-700">
          {caseItem.requestedEquipment}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          {caseItem.equipmentCategory}
        </p>
      </TableCell>
      <TableCell className="text-slate-600">{caseItem.insurer}</TableCell>
      <TableCell>
        <StatusBadge status={caseItem.status} />
      </TableCell>
      <TableCell>
        <span
          className={cn(
            'font-medium',
            caseItem.isFollowUpDue ? 'text-rose-600' : 'text-slate-600',
          )}
        >
          {caseItem.followUpLabel}
        </span>
      </TableCell>
      <TableCell className="text-center">
        {caseItem.missingDocumentationCount > 0 ? (
          <span className="inline-grid min-w-7 place-items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-100">
            {caseItem.missingDocumentationCount}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </TableCell>
      <TableCell className="text-slate-500">{caseItem.lastUpdated}</TableCell>
      <TableCell className="pr-4 text-right">
        <Link href={`/cases/${caseItem.id}`} aria-hidden="true" tabIndex={-1} className="inline-flex size-8 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-100 hover:text-blue-700">
          <ChevronRight />
        </Link>
      </TableCell>
    </TableRow>
  );
}

function MobileCaseCard({ caseItem }: { caseItem: PriorAuthorizationCase }) {
  return (
    <Link
      href={`/cases/${caseItem.id}`}
      className="block border-b border-slate-200 p-4 transition-colors last:border-b-0 hover:bg-slate-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-9 after:border-slate-200">
            <AvatarFallback className="bg-[#e8f5f2] text-xs font-semibold text-[#167567]">
              {caseItem.patientInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-800">
              {caseItem.patientName}
            </p>
            <p className="font-mono text-[11px] text-slate-400">
              {caseItem.id}
            </p>
          </div>
        </div>
        <ChevronRight className="mt-2 size-4 text-slate-300" />
      </div>
      <p className="mt-4 text-sm font-medium text-slate-700">
        {caseItem.requestedEquipment}
      </p>
      <p className="mt-1 text-xs text-slate-400">{caseItem.insurer}</p>
      <div className="mt-4">
        <StatusBadge status={caseItem.status} />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-xs">
        <div>
          <dt className="text-slate-400">Follow-up</dt>
          <dd
            className={cn(
              'mt-1 font-semibold',
              caseItem.isFollowUpDue ? 'text-rose-600' : 'text-slate-600',
            )}
          >
            {caseItem.followUpLabel}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Missing</dt>
          <dd className="mt-1 font-semibold text-slate-600">
            {caseItem.missingDocumentationCount}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Updated</dt>
          <dd className="mt-1 font-semibold text-slate-600">
            {caseItem.lastUpdated}
          </dd>
        </div>
      </dl>
    </Link>
  );
}

export function DashboardApp({
  currentUser,
  cases,
}: {
  currentUser: AppUser;
  cases: PriorAuthorizationCase[];
}) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | CaseStatus>('All');
  const [dueOnly, setDueOnly] = useState(false);
  const [scope, setScope] = useState<'ACTIVE' | 'ARCHIVED' | 'ALL'>('ACTIVE');

  const summary = useMemo(
    () => ({
      active: cases.filter(
        (item) => !item.archivedAt && !['Approved', 'Denied', 'Closed'].includes(item.status),
      ).length,
      needsDocumentation: cases.filter(
        (item) => item.status === 'Needs Documentation',
      ).length,
      pending: cases.filter((item) =>
        ['Submitted', 'Pending', 'Additional Info Requested'].includes(
          item.status,
        ),
      ).length,
      due: cases.filter((item) => item.isFollowUpDue).length,
    }),
    [cases],
  );

  const filteredCases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return cases.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        [item.patientName, item.id, item.requestedEquipment, item.insurer]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      return (
        matchesQuery &&
        (scope === 'ALL' || (scope === 'ARCHIVED' ? Boolean(item.archivedAt) : !item.archivedAt)) &&
        (status === 'All' || item.status === status) &&
        (!dueOnly || item.isFollowUpDue)
      );
    });
  }, [cases, dueOnly, query, scope, status]);

  return (
    <AppShell
      currentUser={currentUser}
      activePage="dashboard"
      caseCount={cases.filter((item) => !item.archivedAt).length}
    >
      <main className="mx-auto w-full max-w-[1540px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {searchParams.get('deleted') === '1' ? (
          <output className="mb-4 block rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Case deleted.
          </output>
        ) : null}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 sm:hidden">
              <Badge
                variant="outline"
                className="border-blue-200 bg-blue-50 text-[10px] font-semibold text-blue-700"
              >
                Synthetic data only
              </Badge>
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.035em] text-slate-900 sm:text-[28px]">
              Prior Authorization Queue
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
              Track case readiness, documentation gaps, and insurer follow-ups
              in one operational view.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
          <Link href="/cases/new" className="inline-flex h-10 items-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">+ New Patient / Case</Link><Button
            variant={dueOnly ? 'default' : 'outline'}
            size="lg"
            onClick={() => setDueOnly((value) => !value)}
            className={cn(
              'h-10 rounded-xl px-4 shadow-sm',
              dueOnly
                ? 'bg-blue-700 hover:bg-blue-800'
                : 'border-slate-300 bg-slate-50 text-slate-700',
            )}
          >
            <Clock3 data-icon="inline-start" />
            {dueOnly ? 'Showing due cases' : 'Review due cases'}
          </Button></div>
        </div>

        <section
          aria-label="Queue summary"
          className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
        >
          <SummaryCard
            label="Total Active Cases"
            value={summary.active}
            detail="Excludes completed outcomes"
            icon={ClipboardCheck}
            tone="teal"
          />
          <SummaryCard
            label="Needs Documentation"
            value={summary.needsDocumentation}
            detail="Action required before review"
            icon={FileStack}
            tone="amber"
          />
          <SummaryCard
            label="Pending Authorization"
            value={summary.pending}
            detail="Submitted or under review"
            icon={Stethoscope}
            tone="blue"
          />
          <SummaryCard
            label="Follow-ups Due"
            value={summary.due}
            detail="Due today"
            icon={Clock3}
            tone="rose"
          />
        </section>

        <section
          aria-labelledby="case-queue-heading"
          className="mt-5 overflow-hidden rounded-2xl border border-slate-300/90 bg-slate-50 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_44px_rgba(15,23,42,0.045)]"
        >
          <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <h2
                  id="case-queue-heading"
                  className="font-semibold tracking-[-0.015em] text-slate-900"
                >
                  Case queue
                </h2>
                <Badge
                  variant="secondary"
                  className="bg-slate-100 text-slate-600"
                >
                  {filteredCases.length}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                All patient names and case details shown here are synthetic.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label
                htmlFor="case-search"
                className="relative block sm:w-[280px]"
              >
                <span className="sr-only">Search cases</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="case-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search patient, case, equipment..."
                  className="h-10 rounded-xl border-slate-300 bg-slate-100/70 pl-9 shadow-none focus-visible:bg-slate-50"
                />
              </label>
              <NativeSelect aria-label="Filter case archive state" value={scope} onChange={(event) => setScope(event.target.value as typeof scope)} className="w-full sm:w-[145px] [&>select]:h-10 [&>select]:rounded-xl [&>select]:border-slate-300 [&>select]:bg-slate-50"><NativeSelectOption value="ACTIVE">Active</NativeSelectOption><NativeSelectOption value="ARCHIVED">Archived</NativeSelectOption><NativeSelectOption value="ALL">All cases</NativeSelectOption></NativeSelect>
              <NativeSelect
                aria-label="Filter by case status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as 'All' | CaseStatus)
                }
                className="w-full sm:w-[190px] [&>select]:h-10 [&>select]:rounded-xl [&>select]:border-slate-300 [&>select]:bg-slate-50 [&>select]:pl-3"
              >
                <NativeSelectOption value="All">
                  All statuses
                </NativeSelectOption>
                {caseStatuses.map((caseStatus) => (
                  <NativeSelectOption key={caseStatus} value={caseStatus}>
                    {caseStatus}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>

          {filteredCases.length > 0 ? (
            <>
              <div className="hidden xl:block">
                <Table>
                  <TableHeader>
                    <TableRow className="h-11 border-slate-100 bg-slate-50/70 hover:bg-slate-50/70">
                      <TableHead className="pl-5 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                        Patient / Case ID
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                        Requested equipment
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                        Insurer
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                        Status
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                        Follow-up due
                      </TableHead>
                      <TableHead className="text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                        Missing docs
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                        Last updated
                      </TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCases.map((caseItem) => (
                      <CaseRow key={caseItem.id} caseItem={caseItem} />
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="xl:hidden">
                {filteredCases.map((caseItem) => (
                  <MobileCaseCard key={caseItem.id} caseItem={caseItem} />
                ))}
              </div>
            </>
          ) : (
            <div className="grid min-h-64 place-items-center px-6 py-12 text-center">
              <div>
                <div className="mx-auto grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-400">
                  <Search className="size-5" />
                </div>
                <p className="mt-4 font-semibold text-slate-700">
                  No cases match these filters
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Try another search or clear the due-case filter.
                </p>
                <Button
                  variant="outline"
                  className="mt-4 border-slate-200"
                  onClick={() => {
                    setQuery('');
                    setStatus('All');
                    setDueOnly(false);
                  }}
                >
                  Clear filters
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p>
              Showing {filteredCases.length} of {cases.length} synthetic cases
            </p>
            <p>Prototype view · No external submissions enabled</p>
          </div>
        </section>

        <div className="mt-5 flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-xs leading-5 text-sky-800">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <p>
            This copilot supports prior authorization specialists with workflow
            organization. It does not make medical-necessity or coverage
            decisions.
          </p>
        </div>
      </main>
    </AppShell>
  );
}
