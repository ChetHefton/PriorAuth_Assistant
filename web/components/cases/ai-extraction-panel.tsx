'use client';

import { useMemo, useState } from 'react';
import {
  Bot,
  Check,
  CircleAlert,
  FileSearch,
  LoaderCircle,
  PencilLine,
  Quote,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { CaseDocument } from '@/types/case';
import {
  extractionFactLabels,
  type DocumentAnalysis,
  type ExtractedFact,
  type ExtractionConfidence,
} from '@/types/extraction';

type Notice = { tone: 'success' | 'error'; message: string } | null;

const confidenceStyles: Record<ExtractionConfidence, string> = {
  HIGH: 'border-blue-200 bg-blue-50 text-blue-700',
  MEDIUM: 'border-amber-200 bg-amber-50 text-amber-800',
  LOW: 'border-rose-200 bg-rose-50 text-rose-700',
};

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  }).format(new Date(value));
}

export function AiExtractionPanel({
  caseId,
  document,
  canWrite,
  onAnalysisUpdated,
  onStatusUpdated,
}: {
  caseId: string;
  document: CaseDocument;
  canWrite: boolean;
  onAnalysisUpdated?: (analysis: DocumentAnalysis) => void;
  onStatusUpdated?: (status: CaseDocument['reviewStatus']) => void;
}) {
  const [analyses, setAnalyses] = useState(document.analyses);
  const [analyzing, setAnalyzing] = useState(false);
  const [busyFactId, setBusyFactId] = useState<string | null>(null);
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const latest = analyses[0];
  const canAnalyze = document.mimeType === 'text/plain';

  const factGroups = useMemo(() => {
    const facts = latest?.facts ?? [];
    return {
      attention: facts.filter((fact) => fact.reviewDecision === 'PENDING'),
      found: facts.filter((fact) => fact.reviewDecision !== 'AUTO_RESOLVED'),
      missing: facts.filter((fact) => fact.reviewDecision === 'AUTO_RESOLVED'),
    };
  }, [latest]);

  const attentionCount = factGroups.attention.length;

  async function parseResponse<T>(response: Response): Promise<T & { error?: string }> {
    return response.json().catch(() => ({
      error: 'The server returned an invalid response.',
    })) as Promise<T & { error?: string }>;
  }

  async function requestAnalysis() {
    setAnalyzing(true);
    onStatusUpdated?.('ANALYZING');
    setNotice(null);
    try {
      const response = await fetch(
        `/api/cases/${caseId}/documents/${document.id}/analyses`,
        { method: 'POST', credentials: 'same-origin' },
      );
      const result = await parseResponse<{ analysis?: DocumentAnalysis }>(response);
      if (!response.ok || !result.analysis) {
        onStatusUpdated?.('ANALYSIS_FAILED');
        setNotice({ tone: 'error', message: result.error || 'Unable to analyze the document.' });
        return;
      }
      setAnalyses((current) => [
        result.analysis!,
        ...current.filter((item) => item.id !== result.analysis!.id),
      ]);
      onAnalysisUpdated?.(result.analysis);
      setDrafts({});
      setEditingFactId(null);
      setNotice({
        tone: 'success',
        message: 'Extraction completed. Review only the flagged exceptions.',
      });
    } catch {
      setNotice({ tone: 'error', message: 'Unable to reach the local application.' });
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveReview(
    analysis: DocumentAnalysis,
    fact: ExtractedFact,
    action: 'accept' | 'reject',
  ) {
    const draft = (drafts[fact.id] ?? fact.reviewedValue ?? fact.originalValue ?? '').trim();
    const decision =
      action === 'reject'
        ? 'REJECTED'
        : fact.originalValue === null || draft !== fact.originalValue
          ? 'EDITED'
          : 'ACCEPTED';
    if (action === 'accept' && !draft) {
      setNotice({ tone: 'error', message: 'Enter a verified value before saving this field.' });
      return;
    }

    setBusyFactId(fact.id);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/cases/${caseId}/documents/${document.id}/analyses/${analysis.id}/facts/${fact.id}`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision,
            ...(decision === 'EDITED' ? { reviewedValue: draft } : {}),
          }),
        },
      );
      const result = await parseResponse<{ analysis?: DocumentAnalysis }>(response);
      if (!response.ok || !result.analysis) {
        setNotice({ tone: 'error', message: result.error || 'Unable to save the review decision.' });
        return;
      }
      setAnalyses((current) =>
        current.map((item) => (item.id === result.analysis!.id ? result.analysis! : item)),
      );
      onAnalysisUpdated?.(result.analysis);
      setEditingFactId(null);
      setNotice({
        tone: 'success',
        message:
          decision === 'REJECTED'
            ? 'AI-proposed value marked incorrect.'
            : 'Human-reviewed value saved.',
      });
    } catch {
      setNotice({ tone: 'error', message: 'Unable to reach the local application.' });
    } finally {
      setBusyFactId(null);
    }
  }

  function beginEdit(fact: ExtractedFact) {
    setDrafts((current) => ({
      ...current,
      [fact.id]: current[fact.id] ?? fact.reviewedValue ?? fact.originalValue ?? '',
    }));
    setEditingFactId(fact.id);
  }

  function renderFact(fact: ExtractedFact) {
    const draft = drafts[fact.id] ?? fact.reviewedValue ?? fact.originalValue ?? '';
    const needsReview = fact.reviewDecision === 'PENDING' || fact.reviewDecision === 'SUGGESTED';
    const isFinal = ['ACCEPTED', 'EDITED', 'REJECTED'].includes(fact.reviewDecision);
    const isEditing = editingFactId === fact.id;

    return (
      <article
        key={fact.id}
        className={cn(
          'flex min-h-[190px] flex-col rounded-xl border p-4',
          needsReview
            ? fact.evidenceStatus === 'CONTRADICTORY'
              ? 'border-rose-200 bg-rose-50/65'
              : 'border-amber-200 bg-amber-50/65'
            : isFinal && fact.reviewDecision !== 'REJECTED'
              ? 'border-emerald-200 bg-emerald-50/45'
              : 'border-slate-200 bg-slate-50/90',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-600">
              {extractionFactLabels[fact.fieldKey]}
            </p>
            <p className="mt-1 text-sm font-semibold leading-5 text-slate-900">
              {fact.reviewedValue ?? fact.originalValue ?? 'Not found'}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn('shrink-0 text-[9px]', confidenceStyles[fact.confidence])}
          >
            {fact.confidence}
          </Badge>
        </div>
        <div className="mt-2 flex min-h-5 flex-wrap items-center gap-1.5">
          {fact.reviewDecision === 'REJECTED' ? (
            <Badge variant="outline" className="border-rose-200 bg-rose-50 text-[9px] text-rose-700">Incorrect</Badge>
          ) : isFinal ? (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[9px] text-emerald-700">Verified</Badge>
          ) : needsReview ? (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[9px] text-amber-800">Needs review</Badge>
          ) : fact.reviewDecision === 'AUTO_RESOLVED' ? (
            <Badge variant="outline" className="border-slate-200 bg-slate-100 text-[9px] text-slate-600">Missing</Badge>
          ) : null}
          {fact.evidenceStatus === 'CONTRADICTORY' ? (
            <Badge variant="outline" className="border-rose-200 bg-rose-50 text-[9px] text-rose-700">Contradictory evidence</Badge>
          ) : null}
        </div>
        {fact.sourceQuote ? (
          <details open className="mt-2 rounded-lg border border-slate-200/80 bg-slate-100/70 px-2.5 py-1.5 text-[10px] text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-600">Source evidence · {fact.confidence}</summary>
            <div className="mt-1.5 flex items-start gap-1.5 italic leading-4">
              <Quote className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
              <span>“{fact.sourceQuote}”</span>
            </div>
          </details>
        ) : null}
        {fact.uncertaintyNote ? (
          <p className="mt-2 text-[11px] leading-5 text-amber-800">{fact.uncertaintyNote}</p>
        ) : null}

        {isFinal ? (
          <div className="mt-3 flex items-start justify-between gap-3 border-t border-slate-200 pt-3 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              {fact.reviewDecision === 'REJECTED' ? (
                <X className="mt-0.5 size-3.5 shrink-0 text-rose-600" />
              ) : fact.reviewDecision === 'EDITED' ? (
                <PencilLine className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />
              ) : (
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />
              )}
              <p className="text-[10px] text-slate-500">
                {fact.reviewerDisplayName ?? 'Reviewer'}
                {fact.reviewedAt ? ` · ${formatTime(fact.reviewedAt)}` : ''}
              </p>
            </div>
            {canWrite && fact.reviewDecision !== 'REJECTED' ? (
              <button
                type="button"
                onClick={() => beginEdit(fact)}
                className="text-[10px] font-semibold text-blue-700 hover:text-blue-800"
              >
                Edit
              </button>
            ) : null}
          </div>
        ) : null}

        {canWrite && !isFinal && !isEditing ? (
          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
            {needsReview ? (
              <Button
                type="button"
                size="sm"
                disabled={busyFactId === fact.id}
                onClick={() => void saveReview(latest!, fact, 'accept')}
                className="h-8 bg-emerald-700 text-xs hover:bg-emerald-800"
              >
                <Check /> Verify value
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busyFactId === fact.id}
              onClick={() => void saveReview(latest!, fact, 'reject')}
              className="h-8 border-rose-200 bg-slate-50 text-xs text-rose-700 hover:bg-rose-50"
            >
              <X /> Mark incorrect
            </Button>
            <button
              type="button"
              onClick={() => beginEdit(fact)}
              className="text-[10px] font-semibold text-slate-600 underline-offset-2 hover:text-blue-700 hover:underline"
            >
              Edit
            </button>
          </div>
        ) : null}

        {canWrite && isEditing ? (
          <div className="mt-3 border-t border-slate-200 pt-3">
            <label
              htmlFor={`fact-${fact.id}`}
              className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500"
            >
              Human-verified value
            </label>
            <Input
              id={`fact-${fact.id}`}
              value={draft}
              maxLength={1_000}
              onChange={(event) =>
                setDrafts((current) => ({ ...current, [fact.id]: event.target.value }))
              }
              placeholder="Enter a verified value"
              className="mt-1.5 h-9 rounded-lg border-slate-300 bg-slate-50 text-xs"
            />
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busyFactId === fact.id}
                onClick={() => void saveReview(latest!, fact, 'accept')}
                className="h-8 bg-emerald-700 text-xs hover:bg-emerald-800"
              >
                {busyFactId === fact.id ? <LoaderCircle className="animate-spin" /> : <Check />}
                Save &amp; Verify
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditingFactId(null)}
                className="h-8 text-xs text-slate-600"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-300 bg-slate-100/75">
      <div className="flex flex-col gap-3 border-b border-slate-300 bg-slate-50/90 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-lg bg-blue-100 text-blue-700">
              <Bot className="size-4" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">AI Extraction</h3>
            <Badge
              variant="outline"
              className="border-blue-200 bg-blue-50 text-[9px] font-bold uppercase text-blue-700"
            >
              Human oversight
            </Badge>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-slate-600">
            AI-generated extraction — review flagged exceptions before use. Suggested values remain
            separate from verified case data.
          </p>
        </div>
        {canWrite && canAnalyze ? (
          <Button
            type="button"
            variant={latest ? 'outline' : 'default'}
            disabled={analyzing}
            onClick={() => void requestAnalysis()}
            className={cn(
              'shrink-0',
              latest
                ? 'border-blue-200 bg-slate-50 text-blue-700 hover:bg-blue-50'
                : 'bg-blue-700 text-white hover:bg-blue-800',
            )}
          >
            {analyzing ? (
              <LoaderCircle className="animate-spin" />
            ) : latest ? (
              <RotateCcw />
            ) : (
              <FileSearch />
            )}
            {analyzing ? 'Analyzing…' : latest ? 'Analyze again' : 'Analyze with AI'}
          </Button>
        ) : null}
      </div>

      {!canAnalyze ? (
        <div className="flex items-start gap-2.5 p-4 text-xs leading-5 text-slate-600">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" />
          AI analysis currently supports synthetic TXT documents only. PDF and image extraction will be
          added separately; OCR is not enabled.
        </div>
      ) : !latest ? (
        <div className="p-4 text-xs leading-5 text-slate-600">
          {canWrite
            ? 'Run a grounded classification and extraction for this selected document.'
            : 'No extraction has been saved for this document.'}
        </div>
      ) : latest.status === 'FAILED' ? (
        <div className="flex items-start gap-2.5 p-4 text-xs leading-5 text-rose-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          This analysis did not complete. No extracted facts were accepted or written to case data.
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div className="rounded-xl border border-slate-300 bg-slate-50 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                Detected type
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{latest.detectedDocumentType}</p>
                {latest.classificationConfidence ? (
                  <Badge
                    variant="outline"
                    className={confidenceStyles[latest.classificationConfidence]}
                  >
                    {latest.classificationConfidence}
                  </Badge>
                ) : null}
                {latest.classificationNeedsReview ? (
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 text-amber-800"
                  >
                    Needs review
                  </Badge>
                ) : null}
              </div>
              {latest.classificationSourceQuote ? (
                <p className="mt-2 border-l-2 border-blue-200 pl-3 text-xs italic leading-5 text-slate-600">
                  “{latest.classificationSourceQuote}”
                </p>
              ) : null}
            </div>
            <div
              className={cn(
                'rounded-xl border px-4 py-3 text-xs',
                attentionCount
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-slate-300 bg-slate-50 text-slate-600',
              )}
            >
              <p className="font-semibold">
                {attentionCount
                  ? `${attentionCount} ${attentionCount === 1 ? 'item' : 'items'} need review`
                  : 'No extraction exceptions'}
              </p>
              <p className="mt-1">Run {formatTime(latest.requestedAt)}</p>
              {analyses.length > 1 ? <p className="mt-1">{analyses.length} saved analyses</p> : null}
            </div>
          </div>

          {latest.warnings.length ? (
            <details className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                Analysis observations ({latest.warnings.length})
              </summary>
              <ul className="mt-2 space-y-1 pl-5 text-xs leading-5 text-slate-600">
                {latest.warnings.map((warning) => (
                  <li key={warning} className="list-disc">{warning}</li>
                ))}
              </ul>
            </details>
          ) : null}

          {factGroups.attention.length ? (
            <section>
              <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-amber-800">
                <CircleAlert className="size-4" /> Needs attention
              </h4>
              <div className="grid gap-3 lg:grid-cols-2">
                {factGroups.attention.map(renderFact)}
              </div>
            </section>
          ) : null}

          {factGroups.found.some((fact) => fact.reviewDecision !== 'PENDING') ? (
            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600">
                  Grounded values
                </h4>
                <p className="text-[10px] text-slate-500">Original AI output is preserved</p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {factGroups.found
                  .filter((fact) => fact.reviewDecision !== 'PENDING')
                  .map(renderFact)}
              </div>
            </section>
          ) : null}

          {factGroups.missing.length ? (
            <details className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                {factGroups.missing.length} fields not found in this document
              </summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {factGroups.missing.map((fact) =>
                  editingFactId === fact.id ? (
                    renderFact(fact)
                  ) : (
                    <div
                      key={fact.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-100/70 px-3 py-2"
                    >
                      <div>
                        <p className="text-xs font-semibold text-slate-600">
                          {extractionFactLabels[fact.fieldKey]}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          Missing — no review required
                        </p>
                      </div>
                      {canWrite ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => beginEdit(fact)}
                          className="h-7 shrink-0 px-2 text-[10px] text-blue-700 hover:bg-blue-50"
                        >
                          Enter value
                        </Button>
                      ) : null}
                    </div>
                  ),
                )}
              </div>
            </details>
          ) : null}
        </div>
      )}

      {notice ? (
        <output
          className={cn(
            'block border-t px-4 py-3 text-xs font-medium',
            notice.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700',
          )}
        >
          {notice.message}
        </output>
      ) : null}
    </div>
  );
}
