'use client';

import { useMemo, useState, type SyntheticEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Clock3,
  Eye,
  FilePlus2,
  FileText,
  History,
  LoaderCircle,
  MessageSquarePlus,
  Minus,
  Package,
  ShieldCheck,
  UploadCloud,
  UserRound,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AiExtractionPanel } from '@/components/cases/ai-extraction-panel';
import { AuthorizationReadiness } from '@/components/cases/authorization-readiness';
import { SubmissionCommunications } from '@/components/cases/submission-communications';
import { AppealWorkspace } from '@/components/cases/appeal-workspace';
import { ExportActions } from '@/components/cases/export-actions';
import { PriorAuthDraftWorkspace } from '@/components/cases/prior-auth-draft';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { cn } from '@/lib/utils';
import { deriveDocumentReviewStatus } from '@/lib/documents/review-status';
import { ACCEPTED_DOCUMENT_EXTENSIONS } from '@/lib/documents/config';
import {
  caseStatuses,
  checklistStatuses,
  documentationTypeLabels,
  documentationTypes,
  type CaseDetail as CaseDetailData,
  type CaseDocument,
  type CaseNote,
  type CaseStatus,
  type ChecklistStatus,
  type DocumentationChecklistItem,
} from '@/types/case';
import type { PolicyOption } from '@/types/policy';

const statusStyles: Record<CaseStatus, string> = {
  Draft: 'border-slate-200 bg-slate-100 text-slate-700',
  'Needs Documentation': 'border-amber-200 bg-amber-50 text-amber-800',
  'Ready for Submission': 'border-blue-200 bg-blue-50 text-blue-800',
  Submitted: 'border-sky-200 bg-sky-50 text-sky-800',
  Pending: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  'Additional Info Requested': 'border-orange-200 bg-orange-50 text-orange-800',
  Approved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Denied: 'border-rose-200 bg-rose-50 text-rose-800',
  'Appeal Drafting': 'border-violet-200 bg-violet-50 text-violet-800',
  'Appeal Submitted': 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800',
  Closed: 'border-slate-200 bg-slate-100 text-slate-600',
};

const checklistStyles: Record<
  ChecklistStatus,
  { className: string; icon: typeof Check }
> = {
  Received: {
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: Check,
  },
  Missing: {
    className: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: CircleAlert,
  },
  'Needs Review': {
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: Eye,
  },
  'Not Required': {
    className: 'border-slate-200 bg-slate-100 text-slate-500',
    icon: Minus,
  },
};

type Notice = { tone: 'success' | 'error'; message: string } | null;

function formatDate(value: string | null, includeTime = false): string {
  if (!value) return 'Not scheduled';
  const normalized = value.length === 10 ? `${value}T12:00:00.000Z` : value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
    timeZone: 'America/Chicago',
  }).format(new Date(normalized));
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn('h-7 px-3 font-semibold', statusStyles[status])}
    >
      <span className="size-1.5 rounded-full bg-current opacity-75" />
      {status}
    </Badge>
  );
}

function ChecklistBadge({ status }: { status: ChecklistStatus }) {
  const style = checklistStyles[status];
  const Icon = style.icon;
  return (
    <Badge
      variant="outline"
      className={cn('h-7 gap-1.5 px-2.5 font-semibold', style.className)}
    >
      <Icon className="size-3" />
      {status}
    </Badge>
  );
}

function OverviewField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof UserRound;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {Icon ? <Icon className="size-3.5" /> : null}
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-semibold text-slate-700">{value}</dd>
    </div>
  );
}

export function CaseDetail({
  initialCase,
  canWrite,
  canGenerateCommunications,
  policyOptions,
  canManageCases,
}: {
  initialCase: CaseDetailData;
  canWrite: boolean;
  canGenerateCommunications: boolean;
  policyOptions: PolicyOption[];
  canManageCases: boolean;
}) {
  const router = useRouter();
  const [caseData, setCaseData] = useState(initialCase);
  const [statusDraft, setStatusDraft] = useState(initialCase.status);
  const [statusSaving, setStatusSaving] = useState(false);
  const [busyChecklistId, setBusyChecklistId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [deleting, setDeleting] = useState(false);
  async function toggleArchive() {
    const nextArchived = !caseData.archivedAt;
    if (nextArchived && !window.confirm('Archive this case? Its documents and history will be preserved.')) return;
    const response = await fetch(`/api/cases/${caseData.id}/archive`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: nextArchived }) });
    if (!response.ok) { setNotice({ tone: 'error', message: 'Unable to update the case archive state.' }); return; }
    setCaseData((current) => ({ ...current, archivedAt: nextArchived ? new Date().toISOString() : null }));
    setNotice({ tone: 'success', message: nextArchived ? 'Case archived.' : 'Case restored.' });
  }

  async function deleteCase() {
    if (!window.confirm(`Delete ${caseData.id} — ${caseData.patientName}?\n\nThis will permanently remove this synthetic case and its associated data.\n\nThis action cannot be undone.`)) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/cases/${caseData.id}`, { method: 'DELETE', credentials: 'same-origin' });
      const result = await parseResponse<{ success?: boolean }>(response);
      if (!response.ok || result.success !== true) {
        setNotice({ tone: 'error', message: result.error ?? 'Unable to delete this case.' });
        return;
      }
      router.push('/?deleted=1');
    } catch {
      setNotice({ tone: 'error', message: 'Unable to reach the local application.' });
    } finally {
      setDeleting(false);
    }
  }


  const receivedCount = useMemo(
    () =>
      caseData.checklist.filter(
        (item) => item.status === 'Received' || item.status === 'Not Required',
      ).length,
    [caseData.checklist],
  );

  async function parseResponse<T>(
    response: Response,
  ): Promise<T & { error?: string }> {
    return response.json().catch(() => ({
      error: 'The server returned an invalid response.',
    })) as Promise<T & { error?: string }>;
  }

  async function saveStatus() {
    setStatusSaving(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/cases/${caseData.id}/status`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusDraft }),
      });
      const result = await parseResponse<{
        status?: CaseStatus;
        updatedAt?: string;
      }>(response);
      if (!response.ok || !result.status || !result.updatedAt) {
        setNotice({
          tone: 'error',
          message: result.error ?? 'Unable to update the case status.',
        });
        return;
      }
      setCaseData((current) => ({
        ...current,
        status: result.status!,
        updatedAt: result.updatedAt!,
      }));
      setNotice({ tone: 'success', message: 'Authorization status updated.' });
    } catch {
      setNotice({
        tone: 'error',
        message: 'Unable to reach the local application.',
      });
    } finally {
      setStatusSaving(false);
    }
  }

  async function updateChecklist(
    item: DocumentationChecklistItem,
    status: ChecklistStatus,
  ) {
    setBusyChecklistId(item.id);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/cases/${caseData.id}/checklist/${encodeURIComponent(item.id)}`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
      );
      const result = await parseResponse<{ item?: DocumentationChecklistItem }>(
        response,
      );
      if (!response.ok || !result.item) {
        setNotice({
          tone: 'error',
          message: result.error ?? 'Unable to update the checklist.',
        });
        return;
      }
      setCaseData((current) => ({
        ...current,
        checklist: current.checklist.map((currentItem) =>
          currentItem.id === result.item!.id ? result.item! : currentItem,
        ),
      }));
      setNotice({ tone: 'success', message: `${item.label} updated.` });
    } catch {
      setNotice({
        tone: 'error',
        message: 'Unable to reach the local application.',
      });
    } finally {
      setBusyChecklistId(null);
    }
  }

  async function uploadDocument(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setUploading(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/cases/${caseData.id}/documents`, {
        method: 'POST',
        credentials: 'same-origin',
        body: new FormData(form),
      });
      const result = await parseResponse<{ documents?: CaseDocument[]; results?: Array<{ filename: string; error?: string }> }>(response);
      if (!response.ok || !result.documents?.length) {
        setNotice({
          tone: 'error',
          message: result.error ?? 'Unable to add the document.',
        });
        return;
      }
      setCaseData((current) => ({
        ...current,
        documents: [...(result.documents ?? []), ...current.documents],
      }));
      form.reset();
      setNotice({
        tone: 'success',
        message: `${result.documents?.length ?? 0} document(s) added${result.results?.some((item) => item.error) ? '; some files could not be stored.' : '.'}`,
      });
    } catch {
      setNotice({
        tone: 'error',
        message: 'Unable to reach the local application.',
      });
    } finally {
      setUploading(false);
    }
  }

  async function addNote(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingNote(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/cases/${caseData.id}/notes`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: noteBody }),
      });
      const result = await parseResponse<{ note?: CaseNote }>(response);
      if (!response.ok || !result.note) {
        setNotice({
          tone: 'error',
          message: result.error ?? 'Unable to add the case note.',
        });
        return;
      }
      setCaseData((current) => ({
        ...current,
        notes: [result.note!, ...current.notes],
      }));
      setNoteBody('');
      setNotice({ tone: 'success', message: 'Case note added.' });
    } catch {
      setNotice({
        tone: 'error',
        message: 'Unable to reach the local application.',
      });
    } finally {
      setSavingNote(false);
    }
  }

  async function removeDocument(document: CaseDocument) {
    if (!window.confirm(`Remove ${document.originalFilename}? Analyzed documents are archived.`)) return;
    const response = await fetch(`/api/cases/${caseData.id}/documents/${document.id}`, { method: 'DELETE' });
    if (response.ok) { setCaseData((current) => ({ ...current, documents: current.documents.filter((item) => item.id !== document.id) })); setNotice({ tone: 'success', message: 'Document removed or archived.' }); }
  }

  return (
    <main className="mx-auto w-full max-w-[1540px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-700"
      >
        <ArrowLeft className="size-4" />
        Back to case queue
      </Link>

      <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar className="size-12 after:border-blue-100">
            <AvatarFallback className="bg-[#e8f5f2] text-sm font-bold text-[#167567]">
              {caseData.patientInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-[-0.035em] text-slate-900 sm:text-[28px]">
                {caseData.patientName}
              </h1>
              <Badge
                variant="outline"
                className="border-sky-100 bg-sky-50 text-[10px] font-bold uppercase tracking-[0.08em] text-sky-700"
              >
                Synthetic
              </Badge>
            </div>
            <p className="mt-1.5 text-sm text-slate-500">
              <span className="font-mono text-xs">{caseData.id}</span>
              <span className="mx-2 text-slate-300">·</span>
              {caseData.requestedEquipment}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManageCases ? <Button type="button" variant="outline" size="sm" onClick={() => void toggleArchive()} className="border-slate-300 bg-slate-50 text-slate-700">{caseData.archivedAt ? 'Restore case' : 'Archive case'}</Button> : null}
          <StatusBadge status={caseData.status} />
          <Badge
            variant="outline"
            className={cn(
              'h-7 px-3 font-semibold',
              caseData.priority === 'Urgent'
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : caseData.priority === 'High'
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-slate-200 bg-white text-slate-600',
            )}
          >
            {caseData.priority} priority
          </Badge>
        </div>
      </div>

      {notice ? (
        <output
          className={cn(
            'mt-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm',
            notice.tone === 'success'
              ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
              : 'border-rose-100 bg-rose-50 text-rose-700',
          )}
        >
          {notice.tone === 'success' ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <CircleAlert className="size-4" />
          )}
          {notice.message}
        </output>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-300/90 bg-slate-50 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.045)]">
            <div className="flex items-center gap-2.5">
              <UserRound className="size-[18px] text-blue-700" />
              <h2 className="font-semibold text-slate-900">Case overview</h2>
            </div>
            <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <OverviewField label="Case ID" value={caseData.id} />
              <OverviewField label="Patient" value={caseData.patientName} />
              <OverviewField
                label="Assigned specialist"
                value={caseData.assignedSpecialist}
              />
              <OverviewField
                label="Requested equipment"
                value={caseData.requestedEquipment}
                icon={Package}
              />
              <OverviewField
                label="Equipment category"
                value={caseData.equipmentCategory}
              />
              <OverviewField
                label="Insurer / plan"
                value={`${caseData.insurer} · ${caseData.insurerPlan}`}
              />
              <OverviewField
                label="Created"
                value={formatDate(caseData.createdAt)}
              />
              <OverviewField
                label="Last updated"
                value={formatDate(caseData.updatedAt, true)}
              />
              <OverviewField
                label="Follow-up due"
                value={formatDate(caseData.followUpDue)}
                icon={CalendarClock}
              />
            </dl>
          </section>

          <PriorAuthDraftWorkspace
            caseId={caseData.id}
            initialDraft={caseData.priorAuthDraft}
            checklist={caseData.checklist}
            canWrite={canWrite}
          />
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><ExportActions caseId={caseData.id} ready={caseData.submissionPacket?.readyForPreparation ?? false} /></div>

          <AuthorizationReadiness
            caseId={caseData.id}
            initialEvaluation={caseData.readiness}
            policyOptions={policyOptions}
            documents={caseData.documents}
            canWrite={canWrite}
            draftUpdatedAt={caseData.priorAuthDraft?.updatedAt}
          />

          <SubmissionCommunications caseId={caseData.id} packet={caseData.submissionPacket} submission={caseData.submission} communications={caseData.communications} canGenerate={canGenerateCommunications} canWrite={canWrite} />
          {caseData.status === 'Denied' || caseData.appeal?.denial ? <AppealWorkspace caseId={caseData.id} initial={caseData.appeal} canGenerate={canGenerateCommunications} canWrite={canWrite} /> : null}

          <section className="rounded-2xl border border-slate-300/90 bg-slate-50 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.045)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <Clock3 className="size-[18px] text-blue-700" />
                  <h2 className="font-semibold text-slate-900">
                    Authorization progress
                  </h2>
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Workflow state only. This is not a coverage or
                  medical-necessity decision.
                </p>
              </div>
              <StatusBadge status={caseData.status} />
            </div>
            <div
              className="mt-5 grid grid-cols-4 gap-2"
              aria-label="Authorization workflow stages"
            >
              {['Intake', 'Documentation', 'Insurer review', 'Outcome'].map(
                (step, index) => {
                  const statusIndex = ['Draft'].includes(caseData.status)
                    ? 0
                    : ['Needs Documentation', 'Ready for Submission'].includes(
                          caseData.status,
                        )
                      ? 1
                      : [
                            'Submitted',
                            'Pending',
                            'Additional Info Requested',
                          ].includes(caseData.status)
                        ? 2
                        : 3;
                  return (
                    <div key={step}>
                      <div
                        className={cn(
                          'h-1.5 rounded-full',
                          index <= statusIndex ? 'bg-blue-600' : 'bg-slate-200',
                        )}
                      />
                      <p
                        className={cn(
                          'mt-2 text-[11px] font-semibold',
                          index <= statusIndex
                            ? 'text-slate-600'
                            : 'text-slate-300',
                        )}
                      >
                        {step}
                      </p>
                    </div>
                  );
                },
              )}
            </div>
            <div className="mt-5 border-t border-slate-200 pt-4">
              {canWrite ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="w-full sm:max-w-sm">
                    <label
                      htmlFor="case-status"
                      className="text-xs font-semibold text-slate-600"
                    >
                      Update status
                    </label>
                    <NativeSelect
                      id="case-status"
                      value={statusDraft}
                      onChange={(event) =>
                        setStatusDraft(event.target.value as CaseStatus)
                      }
                      className="mt-2 w-full [&>select]:h-10 [&>select]:rounded-xl [&>select]:border-slate-200"
                    >
                      {caseStatuses.map((status) => (
                        <NativeSelectOption key={status} value={status}>
                          {status}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  <Button
                    type="button"
                    disabled={statusSaving || statusDraft === caseData.status}
                    onClick={() => void saveStatus()}
                    className="h-10 bg-blue-700 px-4 hover:bg-blue-800"
                  >
                    {statusSaving ? (
                      <LoaderCircle className="animate-spin" />
                    ) : null}
                    Save status
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-3 text-sm text-slate-500">
                  <Eye className="size-4" />
                  Your role has read-only access to case workflow data.
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-300/90 bg-slate-50 shadow-[0_12px_36px_rgba(15,23,42,0.045)]">
            <div className="flex items-center justify-between border-b border-slate-100 p-5 sm:px-6">
              <div>
                <div className="flex items-center gap-2.5">
                  <ClipboardList className="size-[18px] text-blue-700" />
                  <h2 className="font-semibold text-slate-900">
                    Documentation checklist
                  </h2>
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Configured prototype checklist; no insurer-specific rules are
                  applied.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {receivedCount}/{caseData.checklist.length} resolved
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {caseData.checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      {item.label}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Synthetic checklist item
                    </p>
                  </div>
                  {canWrite ? (
                    <NativeSelect
                      aria-label={`Status for ${item.label}`}
                      value={item.status}
                      disabled={busyChecklistId === item.id}
                      onChange={(event) =>
                        void updateChecklist(
                          item,
                          event.target.value as ChecklistStatus,
                        )
                      }
                      className="w-full sm:w-[165px] [&>select]:h-9 [&>select]:rounded-xl [&>select]:border-slate-200"
                    >
                      {checklistStatuses.map((status) => (
                        <NativeSelectOption key={status} value={status}>
                          {status}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  ) : (
                    <ChecklistBadge status={item.status} />
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-300/90 bg-slate-50 shadow-[0_12px_36px_rgba(15,23,42,0.045)]">
            <div className="border-b border-slate-100 p-5 sm:px-6">
              <div className="flex items-center gap-2.5">
                <FileText className="size-[18px] text-blue-700" />
                <h2 className="font-semibold text-slate-900">
                  Source documents
                </h2>
                <Badge
                  variant="secondary"
                  className="bg-slate-100 text-slate-600"
                >
                  {caseData.documents.length}
                </Badge>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Synthetic local files only. No OCR is performed; AI analysis
                sends only the selected TXT document when requested.
              </p>
            </div>
            {canWrite ? (
              <form
                onSubmit={uploadDocument}
                className="grid gap-3 border-b border-slate-100 bg-slate-50/60 p-5 sm:grid-cols-[190px_minmax(0,1fr)_auto] sm:items-end sm:px-6"
              >
                <div>
                  <label
                    htmlFor="document-type"
                    className="text-xs font-semibold text-slate-600"
                  >
                    Document type
                  </label>
                  <NativeSelect
                    id="document-type"
                    name="documentType"
                    defaultValue="SUPPORTING_DOCUMENTATION"
                    className="mt-2 w-full [&>select]:h-10 [&>select]:rounded-xl [&>select]:border-slate-300 [&>select]:bg-slate-50"
                  >
                    {documentationTypes.map((type) => (
                      <NativeSelectOption key={type} value={type}>
                        {documentationTypeLabels[type]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const input = event.currentTarget.querySelector('input[type="file"]') as HTMLInputElement | null; if (input && event.dataTransfer.files.length) { const transfer = new DataTransfer(); Array.from(event.dataTransfer.files).forEach((file) => transfer.items.add(file)); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); } }}>
                  <label
                    htmlFor="document-file"
                    className="text-xs font-semibold text-slate-600"
                  >
                    Choose synthetic files or drag a packet here
                  </label>
                  <Input
                    id="document-file"
                    name="file"
                    type="file"
                    multiple
                    accept={ACCEPTED_DOCUMENT_EXTENSIONS}
                    required
                    className="mt-2 h-10 rounded-xl border-slate-300 bg-slate-50 file:mr-3"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={uploading}
                  className="h-10 bg-blue-700 px-4 hover:bg-blue-800"
                >
                  {uploading ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <UploadCloud />
                  )}
                  Upload
                </Button>
                <p className="text-[11px] text-slate-400 sm:col-span-3">
                  PDF, TXT, PNG, JPG, GIF, or WebP · maximum 10 MB · stored
                  outside the public web directory
                </p>
              </form>
            ) : null}
            <div className="divide-y divide-slate-100">
              {caseData.documents.length ? (
                caseData.documents.map((document) => (
                  <article
                    key={document.id}
                    id={`document-${document.id}`}
                    className="scroll-mt-20 px-5 py-4 sm:px-6"
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                        <FileText className="size-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-700">
                            {document.originalFilename}
                          </p>
                          {document.isSynthetic ? (
                            <Badge
                              variant="outline"
                              className="border-sky-100 bg-sky-50 text-[9px] font-bold uppercase text-sky-700"
                            >
                              Synthetic
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {documentationTypeLabels[document.documentType]} ·{' '}
                          {formatBytes(document.fileSize)} ·{' '}
                          {document.uploadedByDisplayName}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Added {formatDate(document.uploadedAt, true)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'shrink-0',
                          ['Reviewed', 'REVIEW_COMPLETE', 'NO_ACTION_NEEDED'].includes(document.reviewStatus)
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : document.reviewStatus === 'ANALYSIS_FAILED'
                              ? 'border-rose-200 bg-rose-50 text-rose-700'
                              : document.reviewStatus === 'NOT_ANALYZED'
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-amber-200 bg-amber-50 text-amber-700',
                        )}
                      >
                        {['REVIEW_COMPLETE', 'NO_ACTION_NEEDED'].includes(document.reviewStatus) ? <Check className="size-3" /> : null}{document.reviewStatus}
                      </Badge>
                      {canWrite ? <Button type="button" size="icon-xs" variant="ghost" aria-label={`Archive ${document.originalFilename}`} onClick={() => removeDocument(document)}>×</Button> : null}
                    </div>
                    <AiExtractionPanel
                      caseId={caseData.id}
                      document={document}
                      canWrite={canWrite}
                      onAnalysisUpdated={(analysis) => setCaseData((current) => ({
                        ...current,
                        priorAuthDraft: current.priorAuthDraft
                          ? { ...current.priorAuthDraft, updatedAt: new Date().toISOString() }
                          : current.priorAuthDraft,
                        documents: current.documents.map((item) => item.id === document.id
                          ? { ...item, analyses: [analysis, ...item.analyses.filter((saved) => saved.id !== analysis.id)], reviewStatus: deriveDocumentReviewStatus([analysis, ...item.analyses.filter((saved) => saved.id !== analysis.id)]) }
                          : item),
                      }))}
                      onStatusUpdated={(status) => setCaseData((current) => ({
                        ...current,
                        documents: current.documents.map((item) => item.id === document.id ? { ...item, reviewStatus: status } : item),
                      }))}
                    />
                  </article>
                ))
              ) : (
                <div className="grid min-h-36 place-items-center p-6 text-center">
                  <div>
                    <FilePlus2 className="mx-auto size-5 text-slate-300" />
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      No source documents yet
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-300/90 bg-slate-50 shadow-[0_12px_36px_rgba(15,23,42,0.045)]">
            <div className="border-b border-slate-100 p-5 sm:px-6">
              <div className="flex items-center gap-2.5">
                <History className="size-[18px] text-blue-700" />
                <h2 className="font-semibold text-slate-900">
                  Case notes & history
                </h2>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Operational notes associated with this synthetic case.
              </p>
            </div>
            {canWrite ? (
              <form
                onSubmit={addNote}
                className="border-b border-slate-100 bg-slate-50/60 p-5 sm:px-6"
              >
                <label
                  htmlFor="case-note"
                  className="text-xs font-semibold text-slate-600"
                >
                  Add a case note
                </label>
                <textarea
                  id="case-note"
                  value={noteBody}
                  onChange={(event) => setNoteBody(event.target.value)}
                  required
                  maxLength={2000}
                  rows={3}
                  className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15"
                  placeholder="Add a concise synthetic workflow note…"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-400">
                    Do not enter real PHI in this prototype.
                  </p>
                  <Button
                    type="submit"
                    disabled={savingNote || !noteBody.trim()}
                    className="bg-blue-700 hover:bg-blue-800"
                  >
                    {savingNote ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <MessageSquarePlus />
                    )}
                    Add note
                  </Button>
                </div>
              </form>
            ) : null}
            <div className="divide-y divide-slate-100">
              {caseData.notes.length ? (
                caseData.notes.map((note) => (
                  <article key={note.id} className="px-5 py-4 sm:px-6">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {note.body}
                    </p>
                    <p className="mt-2 text-[11px] font-medium text-slate-400">
                      {note.authorDisplayName} ·{' '}
                      {formatDate(note.createdAt, true)}
                    </p>
                  </article>
                ))
              ) : (
                <p className="p-6 text-center text-sm text-slate-400">
                  No case notes yet.
                </p>
              )}
            </div>
          </section>
          {canManageCases ? (
            <section className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5">
              <h2 className="text-sm font-semibold text-rose-900">Danger Zone</h2>
              <p className="mt-1.5 text-xs leading-5 text-rose-900/70">
                Delete this synthetic case and its associated case data. This action cannot be undone.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={() => void deleteCase()}
                className="mt-4 border-rose-300 bg-white text-rose-700 hover:bg-rose-100 hover:text-rose-800"
              >
                {deleting ? <LoaderCircle className="animate-spin" /> : null}
                Delete case
              </Button>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20">
          <section className="rounded-2xl border border-blue-200 bg-blue-50/80 p-5 shadow-[0_12px_32px_rgba(30,64,175,0.04)]">
            <div className="flex items-center gap-2 text-blue-800">
              <ShieldCheck className="size-[18px]" />
              <h2 className="text-sm font-semibold">Human review required</h2>
            </div>
            <p className="mt-3 text-xs leading-5 text-blue-950/70">
              Review case data, checklist states, and every source document
              before any external submission. This prototype does not make
              medical-necessity or coverage decisions.
            </p>
          </section>
          <section className="rounded-2xl border border-slate-300 bg-slate-50 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
            <h2 className="text-sm font-semibold text-slate-800">Follow-up</h2>
            <div className="mt-4 flex items-center gap-3">
              <div
                className={cn(
                  'grid size-10 place-items-center rounded-xl ring-1',
                  caseData.isFollowUpDue
                    ? 'bg-rose-50 text-rose-700 ring-rose-100'
                    : 'bg-sky-50 text-sky-700 ring-sky-100',
                )}
              >
                <CalendarClock className="size-[18px]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {caseData.followUpLabel}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {formatDate(caseData.followUpDue)}
                </p>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-slate-300 bg-slate-50 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
            <h2 className="text-sm font-semibold text-slate-800">
              Local document intake
            </h2>
            <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500">
              <UploadCloud className="mt-0.5 size-4 shrink-0 text-slate-400" />
              <p>
                Files stay on this machine under private application storage and
                are not directly web-accessible.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
