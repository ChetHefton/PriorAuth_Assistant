'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ClipboardCheck,
  FileSearch,
  LoaderCircle,
  PencilLine,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { selectConflictCandidate } from '@/lib/drafts/conflict-selection';
import type { DocumentationChecklistItem } from '@/types/case';
import {
  criticalDraftFieldKeys,
  priorAuthDraftFieldLabels,
  priorAuthDraftSections,
  type CaseDraftNotes,
  type PriorAuthDraft,
  type PriorAuthDraftField,
} from '@/types/prior-auth-draft';

type Notice = { tone: 'success' | 'error'; message: string } | null;

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  }).format(new Date(value));
}

function statusLabel(field: PriorAuthDraftField): string {
  return {
    MISSING: 'Missing',
    AUTO_POPULATED: 'AI populated',
    NEEDS_REVIEW: 'Needs review',
    CONFLICT: 'Conflict',
    VERIFIED: 'Human verified',
  }[field.status];
}

function statusStyle(field: PriorAuthDraftField): string {
  return {
    MISSING: 'border-slate-300 bg-slate-100 text-slate-600',
    AUTO_POPULATED: 'border-blue-200 bg-blue-50 text-blue-700',
    NEEDS_REVIEW: 'border-amber-300 bg-amber-50 text-amber-800',
    CONFLICT: 'border-red-300 bg-red-50 text-red-800',
    VERIFIED: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  }[field.status];
}

function NotesGroup({
  title,
  notes,
  tone,
}: {
  title: string;
  notes: CaseDraftNotes[keyof CaseDraftNotes];
  tone: 'blue' | 'amber' | 'red' | 'slate';
}) {
  if (!notes.length) return null;
  return (
    <div
      className={cn(
        'rounded-xl border px-3.5 py-3',
        tone === 'blue' && 'border-blue-200 bg-blue-50/70',
        tone === 'amber' && 'border-amber-200 bg-amber-50/70',
        tone === 'red' && 'border-red-200 bg-red-50/70',
        tone === 'slate' && 'border-slate-200 bg-slate-100/70',
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-slate-600">
        {title}
      </p>
      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-700">
        {notes.map((note) => (
          <li key={`${note.text}-${note.fieldKeys.join('-')}`} className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-current opacity-50" />
            <span>{note.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DraftFieldCard({
  caseId,
  field,
  canWrite,
  onSaved,
  onNotice,
}: {
  caseId: string;
  field: PriorAuthDraftField;
  canWrite: boolean;
  onSaved: (draft: PriorAuthDraft) => void;
  onNotice: (notice: Notice) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(field.displayValue ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!value.trim()) {
      onNotice({ tone: 'error', message: 'Enter a verified value first.' });
      return;
    }
    setSaving(true);
    onNotice(null);
    try {
      const response = await fetch(
        `/api/cases/${caseId}/draft/fields/${field.id}`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        draft?: PriorAuthDraft;
        error?: string;
      } | null;
      if (!response.ok || !result?.draft) {
        onNotice({
          tone: 'error',
          message: result?.error ?? 'Unable to save the verified value.',
        });
        return;
      }
      onSaved(result.draft);
      setEditing(false);
      onNotice({ tone: 'success', message: 'Verified draft value saved.' });
    } catch {
      onNotice({ tone: 'error', message: 'Unable to reach the local application.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <article
      className={cn(
        'rounded-xl border bg-slate-50/80 p-3.5',
        field.status === 'CONFLICT'
          ? 'border-red-200'
          : field.status === 'NEEDS_REVIEW'
            ? 'border-amber-200'
            : 'border-slate-200',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-600">
            {priorAuthDraftFieldLabels[field.fieldKey]}
          </p>
          <p
            className={cn(
              'mt-1 text-sm font-semibold leading-5',
              field.displayValue ? 'text-slate-900' : 'text-slate-400',
            )}
          >
            {field.status === 'CONFLICT'
              ? 'No value selected'
              : field.displayValue ?? 'Missing'}
          </p>
        </div>
        <Badge variant="outline" className={cn('shrink-0 text-[9px]', statusStyle(field))}>
          {statusLabel(field)}
        </Badge>
      </div>

      {field.status === 'CONFLICT' ? (
        <div className="mt-3 space-y-2 rounded-lg border border-red-100 bg-red-50/60 p-2.5">
          {field.sources.map((source) => (
            <button
              key={source.extractedFactId}
              type="button"
              disabled={!canWrite}
              onClick={() => {
                const selection = selectConflictCandidate(source.value);
                setValue(selection.value);
                setEditing(true);
              }}
              className="group w-full rounded-lg border border-transparent p-2 text-left text-xs text-slate-700 transition hover:border-red-200 hover:bg-white focus-visible:border-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
              aria-label={`Use candidate value ${source.value} from ${source.documentFilename}`}
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="font-semibold">{source.documentFilename}</span>
                  <span className="mt-0.5 block text-slate-800">{source.value}</span>
                </span>
                <span className="shrink-0 text-[10px] font-semibold text-red-700 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  Use this value
                </span>
              </span>
            </button>
          ))}
          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-red-700">
            Human resolution required
          </p>
        </div>
      ) : null}

      {editing ? (
        <div className="mt-3 border-t border-slate-200 pt-3">
          <label htmlFor={`draft-${field.id}`} className="text-[10px] font-bold uppercase tracking-[0.07em] text-slate-500">
            Human-verified value
          </label>
          <Input
            id={`draft-${field.id}`}
            value={value}
            maxLength={2_000}
            onChange={(event) => setValue(event.target.value)}
            className="mt-1.5 h-9 border-slate-300 bg-slate-50 text-xs text-slate-900"
          />
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" disabled={saving} onClick={() => void save()} className="h-8 bg-slate-800 text-xs hover:bg-slate-900">
              {saving ? <LoaderCircle className="animate-spin" /> : <Check />}
              Save verified value
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-8 text-xs text-slate-600">
              Cancel
            </Button>
          </div>
        </div>
      ) : canWrite ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)} className="mt-2 h-7 px-2 text-[11px] text-slate-600 hover:bg-slate-200/70">
          <PencilLine />
          {field.status === 'MISSING'
            ? 'Enter value'
            : field.status === 'CONFLICT'
              ? 'Resolve conflict'
              : 'Verify or correct'}
        </Button>
      ) : null}

      {field.sources.length ? (
        <details className="group mt-2 border-t border-slate-200 pt-2">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[10px] font-semibold text-blue-700">
            <FileSearch className="size-3.5" />
            {field.sources.length} evidence source{field.sources.length === 1 ? '' : 's'}
            <ChevronDown className="ml-auto size-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 space-y-2">
            {field.sources.map((source) => (
              <div key={source.extractedFactId} className="rounded-lg border border-slate-300 bg-slate-100/70 p-2.5 text-[11px] leading-5 text-slate-600">
                <div className="flex flex-wrap items-center gap-1.5">
                  <a href={`#document-${source.documentId}`} className="font-semibold text-blue-700 hover:underline">
                    {source.documentFilename}
                  </a>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[8px] text-slate-600">
                    {source.confidence}
                  </Badge>
                  <Badge variant="outline" className={cn('text-[8px]', source.valueOrigin === 'AI_POPULATED' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>
                    {source.valueOrigin === 'AI_POPULATED'
                      ? 'AI populated'
                      : source.valueOrigin === 'HUMAN_CORRECTED'
                        ? 'Human corrected'
                        : 'Human verified'}
                  </Badge>
                </div>
                <p className="mt-1.5 italic text-slate-500">“{source.sourceQuote}”</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

export function PriorAuthDraftWorkspace({
  caseId,
  initialDraft,
  checklist,
  canWrite,
}: {
  caseId: string;
  initialDraft: PriorAuthDraft | null;
  checklist: DocumentationChecklistItem[];
  canWrite: boolean;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const attentionFields = useMemo(() => {
    if (!draft) return [];
    return draft.fields.filter(
      (field) =>
        field.status === 'CONFLICT' ||
        field.status === 'NEEDS_REVIEW' ||
        (field.status === 'MISSING' &&
          criticalDraftFieldKeys.includes(field.fieldKey)),
    );
  }, [draft]);

  async function generate() {
    setGenerating(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/cases/${caseId}/draft`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      const result = (await response.json().catch(() => null)) as {
        draft?: PriorAuthDraft;
        error?: string;
      } | null;
      if (!response.ok || !result?.draft) {
        setNotice({
          tone: 'error',
          message: result?.error ?? 'Unable to generate the draft.',
        });
        return;
      }
      setDraft(result.draft);
      setNotice({
        tone: 'success',
        message: draft
          ? 'Prior authorization draft refreshed.'
          : 'Prior authorization draft generated.',
      });
    } catch {
      setNotice({ tone: 'error', message: 'Unable to reach the local application.' });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-300/90 bg-slate-100/75 shadow-[0_12px_30px_rgba(30,41,59,0.055)]">
      <div className="flex flex-col gap-3 border-b border-slate-300/80 bg-slate-200/55 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <ClipboardCheck className="size-[18px] text-blue-700" />
            <h2 className="font-semibold text-slate-950">Prior Authorization Draft</h2>
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[9px] font-bold uppercase text-blue-700">
              Human workspace
            </Badge>
          </div>
          <p className="mt-1.5 text-xs text-slate-600">
            Pre-populated from grounded evidence. No coverage or medical-necessity decision is made.
          </p>
        </div>
        {canWrite ? (
          <Button type="button" disabled={generating} onClick={() => void generate()} className="shrink-0 bg-blue-700 text-white hover:bg-blue-800">
            {generating ? <LoaderCircle className="animate-spin" /> : draft ? <RefreshCw /> : <Bot />}
            {generating ? 'Building draft…' : draft ? 'Refresh draft' : 'Generate draft'}
          </Button>
        ) : null}
      </div>

      {!draft ? (
        <div className="grid min-h-40 place-items-center px-6 py-8 text-center">
          <div className="max-w-md">
            <Bot className="mx-auto size-6 text-blue-500" />
            <p className="mt-2 text-sm font-semibold text-slate-800">No case-level draft yet</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Analyze one or more synthetic TXT documents, then generate a grounded workspace from their latest completed analyses.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4 p-4 sm:p-5">
          <div className={cn('rounded-xl border p-3.5', attentionFields.length ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50')}>
            <div className="flex items-center gap-2">
              {attentionFields.length ? <AlertTriangle className="size-4 text-amber-700" /> : <ShieldCheck className="size-4 text-emerald-700" />}
              <p className={cn('text-sm font-semibold', attentionFields.length ? 'text-amber-900' : 'text-emerald-900')}>
                {attentionFields.length
                  ? `${attentionFields.length} item${attentionFields.length === 1 ? '' : 's'} need attention`
                  : 'No draft exceptions currently need attention'}
              </p>
            </div>
            {attentionFields.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {attentionFields.map((field) => (
                  <a key={field.id} href={`#draft-field-${field.id}`} className="rounded-md border border-amber-200 bg-white/80 px-2 py-1 text-[10px] font-semibold text-amber-800 hover:bg-white">
                    {priorAuthDraftFieldLabels[field.fieldKey]}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
            <div className="space-y-4">
              {priorAuthDraftSections.map((section) => (
                <section key={section.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-600">{section.label}</h3>
                  <div className="mt-2.5 grid gap-2.5 md:grid-cols-2">
                    {section.fields.map((fieldKey) => {
                      const field = draft.fields.find((item) => item.fieldKey === fieldKey);
                      return field ? (
                        <div key={field.id} id={`draft-field-${field.id}`}>
                          <DraftFieldCard caseId={caseId} field={field} canWrite={canWrite} onSaved={setDraft} onNotice={setNotice} />
                        </div>
                      ) : null;
                    })}
                  </div>
                </section>
              ))}
            </div>

            <aside className="space-y-3">
              <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
                <div className="flex items-center gap-2">
                  <Bot className="size-4 text-blue-700" />
                  <h3 className="text-sm font-semibold text-slate-900">AI case notes</h3>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">Grounded in the evidence index below; specialist review required.</p>
                <div className="mt-3 space-y-2.5">
                  <NotesGroup title="Key supporting evidence" notes={draft.notes.keySupportingEvidence} tone="blue" />
                  <NotesGroup title="Missing information" notes={draft.notes.missingInformation} tone="slate" />
                  <NotesGroup title="Conflicting information" notes={draft.notes.conflictingInformation} tone="red" />
                  <NotesGroup title="Areas requiring review" notes={draft.notes.areasRequiringReview} tone="amber" />
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
                <h3 className="text-sm font-semibold text-slate-900">Documentation coverage</h3>
                <div className="mt-2.5 space-y-2">
                  {checklist.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-700">{item.label}</span>
                      <span className={cn('font-semibold', item.status === 'Received' || item.status === 'Not Required' ? 'text-emerald-700' : item.status === 'Missing' ? 'text-red-700' : 'text-amber-700')}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 border-t border-slate-200 pt-2 text-[10px] leading-4 text-slate-500">Configured workflow checklist only; no insurer-specific requirements are applied.</p>
              </section>
            </aside>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-300 pt-3 text-[10px] text-slate-500">
            <span>Revision {draft.revision} · generated {formatTimestamp(draft.generatedAt)}</span>
            <span>{draft.generatedByDisplayName ?? 'Synthetic workspace'}</span>
          </div>
        </div>
      )}

      {notice ? (
        <output className={cn('block border-t px-5 py-3 text-xs font-medium', notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800')}>
          {notice.message}
        </output>
      ) : null}
    </section>
  );
}
