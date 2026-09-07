import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExportPacket, renderDocx, renderPdf } from '@/lib/exports/prior-auth-export';
import { createIsolatedDatabase } from '@/db/client';
import { priorAuthorizationCases } from '@/db/schema';
import { nextCanonicalCaseId } from '@/lib/cases/canonical-id';

void test('exports have the expected formats and draft labeling', () => {
  const detail = { id:'RM-TEST', patientName:'Synthetic Person', patientInitials:'SP', requestedEquipment:'Power chair', equipmentCategory:'DME', insurer:'Meridian Demo Health', insurerPlan:'Demo Plan', status:'Draft', priority:'Routine', assignedSpecialist:'Unassigned', followUpDue:null, followUpLabel:'—', isFollowUpDue:false, missingDocumentationCount:1, createdAt:'', updatedAt:'', lastUpdated:'', checklist:[], documents:[], notes:[], priorAuthDraft:null, readiness:null } as never;
  const packet = buildExportPacket(detail);
  assert.equal(packet.isDraft, true);
  const pdf = renderPdf(packet);
  const pdfText = pdf.toString('binary');
  assert.ok(pdf.subarray(0,8).toString().startsWith('%PDF-1.'));
  assert.match(pdfText, /PRIOR AUTHORIZATION REQUEST/);
  assert.match(pdfText, /CASE SUMMARY/);
  assert.match(pdfText, /DRAFT \/ NOT READY/);
  assert.doesNotMatch(pdfText, /DRAFT \/ NOT READY - UNRESOLVED REQUIREMENTS/);
  assert.equal(renderDocx(packet).subarray(0,2).toString(), 'PK');
});

void test('new case identifiers use the canonical route-safe format', () => {
  const db = createIsolatedDatabase();
  const now = new Date();
  db.insert(priorAuthorizationCases).values({ id: 'RM-PA-1048', patientDisplayName: 'Existing', patientInitials: 'EX', requestedEquipment: 'Demo', equipmentCategory: 'DME', insurerName: 'Demo', insurerPlan: 'Plan', status: 'Draft', priority: 'Routine', assignedSpecialist: 'Unassigned', followUpDue: null, createdAt: now, updatedAt: now }).run();
  const caseId = nextCanonicalCaseId(db);
  assert.equal(caseId, 'RM-PA-1049');
  assert.match(caseId, /^RM-PA-\d{4}$/);
});
