'use client';

import { useState, type SyntheticEvent } from 'react';
import { Check, Edit3, FileKey2, LoaderCircle, Plus, ShieldCheck, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { documentationTypes, documentationTypeLabels } from '@/types/case';
import {
  policyConditionTypes,
  type PayerPolicy,
  type PolicyRequirement,
} from '@/types/policy';

type Notice = { tone: 'success' | 'error'; message: string } | null;
type RequirementDraft = Omit<PolicyRequirement, 'id' | 'policyId'>;
type PolicyDraft = {
  payerName: string;
  planName: string;
  policyName: string;
  equipmentCategory: string;
  hcpcsCodes: string;
  effectiveDate: string;
  expirationDate: string;
  submissionChannel: string;
  followUpIntervalDays: string;
  sourceReference: string;
  notes: string;
  version: string;
  isActive: boolean;
  requirements: RequirementDraft[];
};

const emptyRequirement = (): RequirementDraft => ({
  requirementKey: `requirement-${Date.now()}`,
  label: '',
  kind: 'DOCUMENT',
  documentType: 'SUPPORTING_DOCUMENTATION',
  fieldKey: null,
  conditionType: 'ALWAYS',
  conditionValue: null,
  requirementLevel: 'REQUIRED',
  explanation: '',
  blocksReadiness: true,
  sortOrder: 0,
});

function toDraft(policy?: PayerPolicy): PolicyDraft {
  return policy
    ? {
        payerName: policy.payerName,
        planName: policy.planName,
        policyName: policy.policyName,
        equipmentCategory: policy.equipmentCategory,
        hcpcsCodes: policy.hcpcsCodes.join(', '),
        effectiveDate: policy.effectiveDate,
        expirationDate: policy.expirationDate ?? '',
        submissionChannel: policy.submissionChannel,
        followUpIntervalDays: policy.followUpIntervalDays?.toString() ?? '',
        sourceReference: policy.sourceReference,
        notes: policy.notes,
        version: policy.version,
        isActive: policy.isActive,
        requirements: policy.requirements.map(({ id: _id, policyId: _policyId, ...requirement }) => requirement),
      }
    : {
        payerName: '',
        planName: '',
        policyName: '',
        equipmentCategory: '',
        hcpcsCodes: '',
        effectiveDate: '2026-01-01',
        expirationDate: '',
        submissionChannel: 'Internal review queue',
        followUpIntervalDays: '7',
        sourceReference: 'Synthetic demonstration policy library',
        notes: '',
        version: 'v1',
        isActive: true,
        requirements: [emptyRequirement()],
      };
}

export function PolicyManagement({ initialPolicies }: { initialPolicies: PayerPolicy[] }) {
  const [policies, setPolicies] = useState(initialPolicies);
  const [editing, setEditing] = useState<PayerPolicy | null>(null);
  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  function startCreate() {
    setEditing(null);
    setDraft(toDraft());
    setNotice(null);
  }

  function startEdit(policy: PayerPolicy) {
    setEditing(policy);
    setDraft(toDraft(policy));
    setNotice(null);
  }

  function updateDraft<K extends keyof PolicyDraft>(key: K, value: PolicyDraft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateRequirement(index: number, changes: Partial<RequirementDraft>) {
    setDraft((current) =>
      current
        ? { ...current, requirements: current.requirements.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item) }
        : current,
    );
  }

  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setNotice(null);
    const payload = {
      ...draft,
      sourceType: 'SYNTHETIC_DEMONSTRATION',
      hcpcsCodes: draft.hcpcsCodes.split(',').map((code) => code.trim()).filter(Boolean),
      expirationDate: draft.expirationDate || null,
      followUpIntervalDays: draft.followUpIntervalDays ? Number(draft.followUpIntervalDays) : null,
      requirements: draft.requirements.map((requirement, index) => ({
        ...requirement,
        sortOrder: index,
        documentType: requirement.kind === 'DOCUMENT' ? requirement.documentType : null,
        fieldKey: requirement.kind === 'FIELD' ? requirement.fieldKey : null,
        conditionValue: requirement.conditionValue || null,
      })),
    };
    try {
      const response = await fetch(
        editing ? `/api/admin/policies/${editing.id}` : '/api/admin/policies',
        {
          method: editing ? 'PATCH' : 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json().catch(() => null)) as { policy?: PayerPolicy; error?: string } | null;
      if (!response.ok || !result?.policy) {
        setNotice({ tone: 'error', message: result?.error ?? 'Unable to save the policy.' });
        return;
      }
      setPolicies((current) => editing ? current.map((item) => item.id === result.policy!.id ? result.policy! : item) : [...current, result.policy!]);
      setDraft(null);
      setEditing(null);
      setNotice({ tone: 'success', message: editing ? 'Synthetic policy updated.' : 'Synthetic policy created.' });
    } catch {
      setNotice({ tone: 'error', message: 'Unable to reach the local application.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1540px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
            <FileKey2 className="size-4" /> Admin
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-[28px]">Payer policies</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">Maintain the small synthetic policy library used by the deterministic readiness workspace.</p>
        </div>
        <Button type="button" onClick={startCreate} className="h-10 bg-blue-700 px-4 hover:bg-blue-800"><Plus /> Create policy</Button>
      </div>

      {notice ? <output className={`mt-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{notice.tone === 'success' ? <Check className="size-4" /> : <X className="size-4" />}{notice.message}</output> : null}

      {draft ? (
        <section className="mt-5 rounded-2xl border border-blue-200 bg-slate-50 p-5 shadow-[0_16px_44px_rgba(15,23,42,0.045)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="font-semibold text-slate-950">{editing ? 'Edit synthetic policy' : 'Create synthetic policy'}</h2><p className="mt-1 text-xs text-slate-600">All records in this prototype are demonstrations and do not represent real payer requirements.</p></div>
            <Button type="button" variant="ghost" size="icon" aria-label="Close policy form" onClick={() => { setDraft(null); setEditing(null); }}><X /></Button>
          </div>
          <form onSubmit={save} className="mt-5 space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {([
                ['payerName', 'Payer name'], ['planName', 'Plan name'], ['policyName', 'Policy name'], ['equipmentCategory', 'Equipment category'],
                ['effectiveDate', 'Effective date'], ['expirationDate', 'Expiration date (optional)'], ['submissionChannel', 'Submission channel'], ['followUpIntervalDays', 'Follow-up interval (days)'], ['version', 'Version'],
              ] as const).map(([key, label]) => <div key={key} className="space-y-1.5"><label htmlFor={`policy-${key}`} className="text-xs font-semibold text-slate-600">{label}</label><Input id={`policy-${key}`} type={key.includes('Date') ? 'date' : 'text'} value={draft[key]} onChange={(event) => updateDraft(key, event.target.value)} required={key !== 'expirationDate'} className="h-10 rounded-xl border-slate-300 bg-slate-50" /></div>)}
              <div className="space-y-1.5"><label htmlFor="policy-codes" className="text-xs font-semibold text-slate-600">HCPCS codes (comma separated)</label><Input id="policy-codes" value={draft.hcpcsCodes} onChange={(event) => updateDraft('hcpcsCodes', event.target.value)} className="h-10 rounded-xl border-slate-300 bg-slate-50" placeholder="E1234, K0005" /></div>
              <div className="space-y-1.5"><label htmlFor="policy-source" className="text-xs font-semibold text-slate-600">Source / citation label</label><Input id="policy-source" value={draft.sourceReference} onChange={(event) => updateDraft('sourceReference', event.target.value)} required className="h-10 rounded-xl border-slate-300 bg-slate-50" /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2"><div className="space-y-1.5"><label htmlFor="policy-notes" className="text-xs font-semibold text-slate-600">Notes</label><textarea id="policy-notes" value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} rows={2} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800" /></div><div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-100/70 px-3 py-2"><input id="policy-active" type="checkbox" checked={draft.isActive} onChange={(event) => updateDraft('isActive', event.target.checked)} className="size-4 accent-blue-700" /><label htmlFor="policy-active" className="text-sm font-semibold text-slate-700">Active in policy matching</label></div></div>
            <div className="space-y-3"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-slate-900">Requirements</h3><p className="text-xs text-slate-600">Each requirement is evaluated deterministically from documents and the verified draft.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setDraft((current) => current ? { ...current, requirements: [...current.requirements, emptyRequirement()] } : current)}><Plus /> Add requirement</Button></div>
              {draft.requirements.map((requirement, index) => <div key={`${requirement.requirementKey}-${index}`} className="rounded-xl border border-slate-300 bg-slate-100/70 p-3"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Input aria-label="Requirement key" value={requirement.requirementKey} onChange={(event) => updateRequirement(index, { requirementKey: event.target.value })} placeholder="Requirement key" className="border-slate-300 bg-slate-50" /><Input aria-label="Requirement label" value={requirement.label} onChange={(event) => updateRequirement(index, { label: event.target.value })} placeholder="Human-readable label" required className="border-slate-300 bg-slate-50" /><NativeSelect aria-label="Requirement kind" value={requirement.kind} onChange={(event) => updateRequirement(index, { kind: event.target.value as RequirementDraft['kind'] })} className="[&>select]:h-9 [&>select]:border-slate-300"><NativeSelectOption value="DOCUMENT">Document</NativeSelectOption><NativeSelectOption value="FIELD">Draft field</NativeSelectOption></NativeSelect><NativeSelect aria-label="Requirement condition" value={requirement.conditionType} onChange={(event) => updateRequirement(index, { conditionType: event.target.value as RequirementDraft['conditionType'] })} className="[&>select]:h-9 [&>select]:border-slate-300">{policyConditionTypes.map((condition) => <NativeSelectOption key={condition} value={condition}>{condition}</NativeSelectOption>)}</NativeSelect></div><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{requirement.kind === 'DOCUMENT' ? <NativeSelect aria-label="Document type" value={requirement.documentType ?? 'SUPPORTING_DOCUMENTATION'} onChange={(event) => updateRequirement(index, { documentType: event.target.value as RequirementDraft['documentType'] })} className="[&>select]:h-9 [&>select]:border-slate-300">{documentationTypes.map((type) => <NativeSelectOption key={type} value={type}>{documentationTypeLabels[type]}</NativeSelectOption>)}</NativeSelect> : <Input aria-label="Draft field key" value={requirement.fieldKey ?? ''} onChange={(event) => updateRequirement(index, { fieldKey: event.target.value || null })} placeholder="Draft field key" className="border-slate-300 bg-slate-50" />}<Input aria-label="Condition value" value={requirement.conditionValue ?? ''} onChange={(event) => updateRequirement(index, { conditionValue: event.target.value || null })} placeholder="Condition value (optional)" className="border-slate-300 bg-slate-50" /><NativeSelect aria-label="Requirement level" value={requirement.requirementLevel} onChange={(event) => updateRequirement(index, { requirementLevel: event.target.value as RequirementDraft['requirementLevel'] })} className="[&>select]:h-9 [&>select]:border-slate-300"><NativeSelectOption value="REQUIRED">Required</NativeSelectOption><NativeSelectOption value="ADVISORY">Advisory</NativeSelectOption></NativeSelect><label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700"><input type="checkbox" checked={requirement.blocksReadiness} onChange={(event) => updateRequirement(index, { blocksReadiness: event.target.checked })} className="size-4 accent-blue-700" /> Blocks readiness</label></div><div className="mt-3 flex gap-3"><Input aria-label="Requirement explanation" value={requirement.explanation} onChange={(event) => updateRequirement(index, { explanation: event.target.value })} placeholder="Why this requirement is shown" required className="border-slate-300 bg-slate-50" /><Button type="button" variant="ghost" size="icon" aria-label="Remove requirement" onClick={() => setDraft((current) => current ? { ...current, requirements: current.requirements.filter((_, itemIndex) => itemIndex !== index) } : current)}><X className="text-rose-700" /></Button></div></div>)}
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => { setDraft(null); setEditing(null); }}>Cancel</Button><Button type="submit" disabled={saving} className="bg-blue-700 hover:bg-blue-800">{saving ? <LoaderCircle className="animate-spin" /> : <Check />} {saving ? 'Saving…' : 'Save policy'}</Button></div>
          </form>
        </section>
      ) : null}

      <section className="mt-5 space-y-3">{policies.map((policy) => <article key={policy.id} className="rounded-2xl border border-slate-300 bg-slate-50 p-5 shadow-[0_10px_28px_rgba(15,23,42,0.035)]"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-950">{policy.payerName} — {policy.planName}</h2><Badge variant="outline" className="border-blue-200 bg-blue-50 text-[9px] font-bold uppercase text-blue-700">Synthetic / demo</Badge><Badge variant="outline" className={policy.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-slate-100 text-slate-600'}>{policy.isActive ? 'Active' : 'Inactive'}</Badge></div><p className="mt-1 text-sm text-slate-700">{policy.policyName} · {policy.equipmentCategory} · version {policy.version}</p><p className="mt-1 text-xs text-slate-500">Effective {policy.effectiveDate}{policy.expirationDate ? ` through ${policy.expirationDate}` : ''} · {policy.submissionChannel}</p></div><Button type="button" variant="outline" size="sm" onClick={() => startEdit(policy)} className="border-slate-300 bg-slate-50 text-slate-700"><Edit3 /> Edit</Button></div><details className="mt-3 border-t border-slate-200 pt-3"><summary className="cursor-pointer text-xs font-semibold text-blue-700">View policy source and requirements</summary><div className="mt-3 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-slate-100/70 p-3 text-xs text-slate-700"><p><span className="font-semibold">Source:</span> {policy.sourceReference}</p><p className="mt-1"><span className="font-semibold">HCPCS:</span> {policy.hcpcsCodes.length ? policy.hcpcsCodes.join(', ') : 'Category-level policy'}</p><p className="mt-1">{policy.notes || 'No additional notes.'}</p></div><div className="rounded-xl border border-slate-200 bg-slate-100/70 p-3 text-xs text-slate-700"><p className="font-semibold">Configured requirements ({policy.requirements.length})</p><ul className="mt-2 space-y-1">{policy.requirements.map((requirement) => <li key={requirement.id}>• {requirement.label} <span className="text-slate-500">({requirement.kind.toLowerCase()})</span></li>)}</ul></div></div></details></article>)}{!policies.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-600">No policies configured yet.</div> : null}</section>
      <div className="mt-5 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs leading-5 text-blue-900"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><p>Policies are synthetic demonstrations only. They are administrative documentation configurations and do not represent coverage, medical necessity, or payer approval rules.</p></div>
    </main>
  );
}
