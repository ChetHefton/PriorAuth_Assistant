'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, FileCheck2, LoaderCircle, ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';
import type { CaseDocument } from '@/types/case';
import type { PolicyOption, ReadinessEvaluation, RequirementResultStatus } from '@/types/policy';

type Notice = { tone: 'success' | 'error'; message: string } | null;

const statusLabels: Record<ReadinessEvaluation['status'], string> = {
  READY_FOR_SPECIALIST_REVIEW: 'Ready for specialist review',
  MISSING_DOCUMENTATION: 'Missing documentation',
  NEEDS_HUMAN_REVIEW: 'Needs human review',
  POLICY_MATCH_UNCLEAR: 'Policy match needs review',
  CONFLICT_DETECTED: 'Conflict detected',
};

const statusStyles: Record<ReadinessEvaluation['status'], string> = {
  READY_FOR_SPECIALIST_REVIEW: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  MISSING_DOCUMENTATION: 'border-amber-200 bg-amber-50 text-amber-900',
  NEEDS_HUMAN_REVIEW: 'border-amber-200 bg-amber-50 text-amber-900',
  POLICY_MATCH_UNCLEAR: 'border-rose-200 bg-rose-50 text-rose-800',
  CONFLICT_DETECTED: 'border-rose-200 bg-rose-50 text-rose-800',
};

const requirementStyles: Record<RequirementResultStatus, string> = {
  PRESENT: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  MISSING: 'border-amber-200 bg-amber-50 text-amber-900',
  NEEDS_REVIEW: 'border-amber-200 bg-amber-50 text-amber-900',
  CONFLICT: 'border-rose-200 bg-rose-50 text-rose-800',
  NOT_APPLICABLE: 'border-slate-200 bg-slate-100 text-slate-600',
};

function documentName(id: string, documents: CaseDocument[]): string {
  return documents.find((document) => document.id === id)?.originalFilename ?? id.slice(0, 12);
}

export function AuthorizationReadiness({
  caseId,
  initialEvaluation,
  policyOptions,
  documents,
  canWrite,
  draftUpdatedAt,
}: {
  caseId: string;
  initialEvaluation: ReadinessEvaluation | null;
  policyOptions: PolicyOption[];
  documents: CaseDocument[];
  canWrite: boolean;
  draftUpdatedAt?: string | null;
}) {
  const [evaluation, setEvaluation] = useState(initialEvaluation);
  const [overridePolicyId, setOverridePolicyId] = useState(
    initialEvaluation?.selectionType === 'MANUAL' ? initialEvaluation.policy?.id ?? '' : '',
  );
  const [evaluating, setEvaluating] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const readinessIsStale = Boolean(
    evaluation &&
      draftUpdatedAt &&
      new Date(evaluation.evaluatedAt).getTime() < new Date(draftUpdatedAt).getTime(),
  );
  const policy = evaluation?.policy;
  const policyDetail = useMemo(() => policyOptions.find((option) => option.id === policy?.id), [policyOptions, policy?.id]);

  async function evaluate() {
    if (evaluation && draftUpdatedAt && new Date(evaluation.evaluatedAt).getTime() >= new Date(draftUpdatedAt).getTime()) {
      setNotice({ tone: 'success', message: 'No changes detected. Refresh the Prior Authorization Draft after updating case data to recalculate readiness.' });
      return;
    }
    setEvaluating(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/cases/${caseId}/readiness`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overridePolicyId ? { policyId: overridePolicyId } : {}),
      });
      const result = (await response.json().catch(() => null)) as { evaluation?: ReadinessEvaluation; error?: string } | null;
      if (!response.ok || !result?.evaluation) {
        setNotice({ tone: 'error', message: result?.error ?? 'Unable to evaluate readiness.' });
        return;
      }
      setEvaluation(result.evaluation);
      setNotice({ tone: 'success', message: result.evaluation.selectionType === 'MANUAL' ? 'Readiness evaluated with the manually selected policy.' : 'Readiness evaluated from the matched policy.' });
    } catch {
      setNotice({ tone: 'error', message: 'Unable to reach the local application.' });
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-300/90 bg-slate-50 shadow-[0_12px_36px_rgba(15,23,42,0.045)]">
      <div className="flex flex-col gap-3 border-b border-slate-300/80 bg-slate-200/55 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-2.5"><FileCheck2 className="mt-0.5 size-[18px] text-blue-700" /><div><h2 className="font-semibold text-slate-950">Authorization readiness</h2><p className="mt-1 text-xs text-slate-600">Administrative documentation check only. This does not determine coverage, approval, or medical necessity.</p></div></div>
        {canWrite ? <Button type="button" onClick={() => void evaluate()} disabled={evaluating} className="shrink-0 bg-blue-700 hover:bg-blue-800">{evaluating ? <LoaderCircle className="animate-spin" /> : <FileCheck2 />}{evaluating ? 'Evaluating…' : evaluation ? 'Refresh readiness' : 'Evaluate readiness'}</Button> : null}
      </div>

      {canWrite && policyOptions.length ? <div className="border-b border-slate-200 bg-slate-100/65 p-4 sm:px-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold text-slate-700">Policy matching</p><p className="text-[11px] text-slate-500">Automatic matching uses payer, plan, category, effective date, and explicitly verified HCPCS codes.</p></div><NativeSelect aria-label="Manual policy override" value={overridePolicyId} onChange={(event) => setOverridePolicyId(event.target.value)} className="w-full sm:w-[330px] [&>select]:h-9 [&>select]:border-slate-300"><NativeSelectOption value="">Use automatic policy match</NativeSelectOption>{policyOptions.map((option) => <NativeSelectOption key={option.id} value={option.id}>{option.payerName} · {option.planName} · {option.version}</NativeSelectOption>)}</NativeSelect></div>{overridePolicyId ? <p className="mt-2 text-[10px] font-semibold text-amber-800">Manual policy selection will be visibly marked and audited.</p> : null}</div> : null}

      {!evaluation ? <div className="grid min-h-32 place-items-center px-6 py-8 text-center"><div><FileCheck2 className="mx-auto size-6 text-blue-500" /><p className="mt-2 text-sm font-semibold text-slate-800">No readiness evaluation yet</p><p className="mt-1 text-xs leading-5 text-slate-600">Run the deterministic check after reviewing the case draft and source documents.</p></div></div> : <div className="space-y-4 p-4 sm:p-5">
        {readinessIsStale ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900">Case data changed — refresh the Prior Authorization Draft and readiness evaluation to update this result.</div> : null}
        <div className={cn('rounded-xl border p-4', statusStyles[evaluation.status])}><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2">{evaluation.status === 'READY_FOR_SPECIALIST_REVIEW' ? <CheckCircle2 className="size-5" /> : evaluation.status === 'POLICY_MATCH_UNCLEAR' || evaluation.status === 'CONFLICT_DETECTED' ? <ShieldAlert className="size-5" /> : <AlertTriangle className="size-5" />}<p className="text-sm font-semibold">{statusLabels[evaluation.status]}</p></div>{evaluation.applicableCount ? <p className="text-xs font-semibold">{evaluation.satisfiedCount} of {evaluation.applicableCount} requirements satisfied</p> : null}</div><p className="mt-2 text-xs leading-5">Next best action: <span className="font-semibold">{evaluation.nextBestAction}</span></p></div>

        <div className="rounded-xl border border-slate-300 bg-slate-100/60 p-3.5"><div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Policy matched</p>{evaluation.selectionType === 'MANUAL' ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[9px] text-amber-800">Manual selection</Badge> : null}{policy?.isSynthetic || policyDetail?.isSynthetic ? <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[9px] font-bold uppercase text-blue-700">Synthetic / demo</Badge> : null}</div><p className="mt-1.5 text-sm font-semibold text-slate-900">{policy ? `${policy.payerName} — ${policy.planName}` : 'No policy selected'}</p>{policy ? <p className="mt-1 text-xs text-slate-600">{policy.policyName} · version {policy.version} · effective {policy.effectiveDate}</p> : null}<p className="mt-1 text-xs text-slate-600">{evaluation.policyMatchReason}</p>{policy ? <details className="mt-2 border-t border-slate-200 pt-2"><summary className="flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-blue-700">View policy traceability <ChevronDown className="size-3.5" /></summary><div className="mt-2 grid gap-2 text-[11px] leading-5 text-slate-600 sm:grid-cols-2"><p><span className="font-semibold">Submission channel:</span> {policy.submissionChannel}</p><p><span className="font-semibold">Source:</span> {policy.sourceReference}</p><p><span className="font-semibold">Source type:</span> {policy.sourceType}</p><p><span className="font-semibold">Follow-up interval:</span> {policy.followUpIntervalDays ? `${policy.followUpIntervalDays} days` : 'Not configured'}</p><p><span className="font-semibold">Effective:</span> {policy.effectiveDate}{policy.expirationDate ? ` through ${policy.expirationDate}` : ''}</p><p className="sm:col-span-2">Requirement explanations below are copied from the configured policy record and are not generated by the model.</p></div></details> : null}</div>

        {evaluation.requirements.length ? <div className="space-y-2.5"><h3 className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600">Configured requirements</h3>{evaluation.requirements.map((requirement) => <article key={requirement.requirementId} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{requirement.label}</p><p className="mt-1 text-xs leading-5 text-slate-600">{requirement.reason}</p></div><Badge variant="outline" className={cn('shrink-0 text-[9px]', requirementStyles[requirement.status])}>{requirement.status.replaceAll('_', ' ')}</Badge></div><details className="mt-2 border-t border-slate-200 pt-2"><summary className="flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-blue-700">Why this requirement is shown <ChevronDown className="size-3.5" /></summary><p className="mt-2 text-[11px] leading-5 text-slate-600">{requirement.explanation}</p>{requirement.sourceDocumentIds.length ? <p className="mt-2 text-[10px] text-slate-500">Source: {requirement.sourceDocumentIds.map((id) => documentName(id, documents)).join(', ')}</p> : null}{requirement.sourceFieldKeys.length ? <p className="mt-1 text-[10px] text-slate-500">Draft field: {requirement.sourceFieldKeys.join(', ')}</p> : null}</details></article>)}</div> : <p className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs leading-5 text-rose-800">No requirements were evaluated because the policy match is unclear. Confirm or manually select a configured synthetic policy.</p>}
      </div>}
      {notice ? <output className={cn('block border-t px-5 py-3 text-xs font-medium', notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800')}>{notice.message}</output> : null}
    </section>
  );
}
