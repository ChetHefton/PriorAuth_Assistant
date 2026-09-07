'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CommunicationRecord, CommunicationType, SubmissionDetails, SubmissionPacket } from '@/types/communications';

const actions: Array<[CommunicationType, string, string]> = [
  ['AUTHORIZATION_REQUEST', 'Authorization request', 'EMAIL'],
  ['INITIAL_SUBMISSION_EMAIL', 'Initial submission email', 'EMAIL'],
  ['FOLLOW_UP_EMAIL', 'Follow-up email', 'EMAIL'],
  ['FAX_COVER', 'Fax cover sheet', 'FAX'],
  ['PHONE_SCRIPT', 'Phone call script', 'PHONE'],
  ['ADDITIONAL_INFO_RESPONSE', 'Additional information response', 'EMAIL'],
];

export function SubmissionCommunications({
  caseId,
  packet: initialPacket,
  submission: initialSubmission,
  communications: initialCommunications,
  canGenerate,
  canWrite,
}: {
  caseId: string;
  packet?: SubmissionPacket;
  submission?: SubmissionDetails;
  communications?: CommunicationRecord[];
  canGenerate: boolean;
  canWrite: boolean;
}) {
  const fallbackPacket: SubmissionPacket = { patient: {}, provider: {}, insurance: {}, request: {}, supportingDocuments: [], unresolvedItems: ['Readiness evaluation has not been run.'], policy: null, readinessStatus: 'NEEDS_HUMAN_REVIEW', readyForPreparation: false };
  const fallbackSubmission: SubmissionDetails = { status: 'Draft', submittedAt: null, submissionChannel: null, externalReferenceNumber: null, lastFollowUpAt: null, nextFollowUpAt: null, submittedByDisplayName: null, isFollowUpDue: false };
  const [packet] = useState(initialPacket ?? fallbackPacket);
  const [submission] = useState(initialSubmission ?? fallbackSubmission);
  const [communications, setCommunications] = useState(initialCommunications ?? []);
  const [busyType, setBusyType] = useState<CommunicationType | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function generate(type: CommunicationType, channel: string, purpose: string) {
    setBusyType(type); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/cases/${caseId}/communications`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, channel, purpose }) });
      const text = await response.text();
      let result: { communication?: CommunicationRecord; error?: string } | null = null;
      try { result = text.trim() ? JSON.parse(text) as { communication?: CommunicationRecord; error?: string } : null; } catch { result = null; }
      if (!response.ok) throw new Error(result?.error ?? (response.status === 403 ? 'You do not have permission to generate communications.' : 'Communication generation failed. Please try again.'));
      if (!result?.communication) throw new Error('Communication generation returned an invalid response. Please try again.');
      setCommunications((current) => [result.communication!, ...current]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Communication generation failed. Please try again.'); }
    finally { setBusyType(null); }
  }

  async function status(id: string, next: CommunicationRecord['status']) {
    const response = await fetch(`/api/cases/${caseId}/communications/${id}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: next }) });
    if (!response.ok) return;
    if (next === 'DISCARDED') { setCommunications((current) => current.filter((communication) => communication.id !== id)); setNotice('Draft discarded.'); }
    else setCommunications((current) => current.map((communication) => communication.id === id ? { ...communication, status: next } : communication));
  }

  async function deleteDraft(id: string) {
    if (!window.confirm('Delete this draft? This cannot be undone.')) return;
    setError(''); setNotice('');
    const response = await fetch(`/api/cases/${caseId}/communications/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    const text = await response.text();
    let result: { error?: string } | null = null;
    try { result = text.trim() ? JSON.parse(text) as { error?: string } : null; } catch { result = null; }
    if (!response.ok) { setError(result?.error ?? 'Unable to delete this draft.'); return; }
    setCommunications((current) => current.filter((communication) => communication.id !== id));
    setNotice('Draft deleted.');
  }

  return <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
    <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Submission &amp; communications</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Prepare the next human-reviewed step</h2></div><Badge>{packet.readyForPreparation ? 'Ready for preparation' : 'Not ready — unresolved requirements'}</Badge></div>
    {packet.unresolvedItems.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Needs attention:</strong> {packet.unresolvedItems.join(' • ')}</div>}
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(packet.request).map(([key, value]) => <div key={key} className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-xs uppercase text-slate-500">{key}</div><div className="mt-1 text-sm font-medium">{value || 'Not verified'}</div></div>)}</div>
    <div className="mt-5 flex flex-wrap gap-2">{actions.map(([type, label, channel]) => <Button key={type} type="button" size="sm" variant="outline" disabled={!canGenerate || Boolean(busyType)} onClick={() => void generate(type, channel, label)}>{busyType === type ? 'Generating…' : label}</Button>)}</div>
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}{notice && <output className="mt-3 block text-sm text-emerald-700">{notice}</output>}
    <div className="mt-6 space-y-3">{communications.map((communication) => <div key={communication.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><div className="font-semibold">{communication.purpose}</div><Badge variant="outline">{communication.status}</Badge></div><p className="mt-2 text-xs text-amber-700">AI-generated draft — human review required before use.</p><pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{(communication.editedContent ?? communication.generatedContent).body}</pre>{canWrite && <div className="mt-3 flex gap-2">{communication.status === 'DRAFT' ? <Button type="button" size="sm" variant="destructive" onClick={() => void deleteDraft(communication.id)}><Trash2 /> Delete draft</Button> : null}<Button type="button" size="sm" variant="outline" onClick={() => void status(communication.id, 'REVIEWED')}>Mark reviewed</Button><Button type="button" size="sm" variant="ghost" onClick={() => void status(communication.id, 'DISCARDED')}>Discard</Button></div>}</div>)}</div>
    <div className="mt-6 border-t border-slate-200 pt-4 text-sm text-slate-600">Submission status: <strong>{submission.status}</strong> · Next follow-up: {submission.nextFollowUpAt ? new Date(submission.nextFollowUpAt).toLocaleDateString() : 'Not scheduled'} {submission.isFollowUpDue && <b className="text-amber-700">(due)</b>}</div>
  </section>;
}
