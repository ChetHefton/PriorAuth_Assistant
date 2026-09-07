import { randomUUID } from 'node:crypto';

import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { getDatabase, type DatabaseClient } from '@/db/client';
import { listDocumentAnalysesForCase } from '@/db/repositories/document-analyses';
import { getPriorAuthDraft } from '@/db/repositories/prior-auth-drafts';
import { getLatestReadiness } from '@/db/repositories/policies';
import { getSubmissionDetails, listCommunications } from '@/db/repositories/communications';
import { buildSubmissionPacket } from '@/lib/submissions/build-submission-packet';
import { getDenial } from '@/db/repositories/denials';
import { compareDenialEvidence } from '@/lib/denials/compare-denial-evidence';
import {
  caseDocuments,
  caseNotes,
  documentationChecklistItems,
  priorAuthorizationCases,
  users,
  type CaseDocumentRecord,
  type CaseNoteRecord,
  type DocumentationChecklistItemRecord,
  type PriorAuthorizationCaseRecord,
} from '@/db/schema';
import type {
  CaseDetail,
  CaseDocument,
  CaseNote,
  CaseStatus,
  ChecklistStatus,
  DocumentationChecklistItem,
  DocumentationType,
  PriorAuthorizationCase,
} from '@/types/case';
import { deriveDocumentReviewStatus } from '@/lib/documents/review-status';

const DISPLAY_TIME_ZONE = 'America/Chicago';

function dateKey(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: DISPLAY_TIME_ZONE,
  }).format(value);
}

function formatFollowUp(
  value: string | null,
  now: Date,
): { label: string; isDue: boolean } {
  if (!value) return { label: '—', isDue: false };

  const today = dateKey(now);
  if (value < today) return { label: 'Overdue', isDue: true };
  if (value === today) return { label: 'Today', isDue: true };

  const todayAtNoon = new Date(`${today}T12:00:00.000Z`);
  const dueAtNoon = new Date(`${value}T12:00:00.000Z`);
  const daysAway = Math.round(
    (dueAtNoon.getTime() - todayAtNoon.getTime()) / 86_400_000,
  );
  if (daysAway === 1) return { label: 'Tomorrow', isDue: false };

  return {
    label: new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(dueAtNoon),
    isDue: false,
  };
}

function formatLastUpdated(value: Date, now: Date): string {
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - value.getTime()) / 60_000),
  );
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function toCaseDto(
  record: PriorAuthorizationCaseRecord,
  missingDocumentationCount: number,
  now = new Date(),
): PriorAuthorizationCase {
  const followUp = formatFollowUp(record.followUpDue, now);
  return {
    id: record.id,
    patientName: record.patientDisplayName,
    patientInitials: record.patientInitials,
    requestedEquipment: record.requestedEquipment,
    equipmentCategory: record.equipmentCategory,
    insurer: record.insurerName,
    insurerPlan: record.insurerPlan,
    status: record.status,
    priority: record.priority,
    assignedSpecialist: record.assignedSpecialist,
    followUpDue: record.followUpDue,
    followUpLabel: followUp.label,
    isFollowUpDue: followUp.isDue,
    missingDocumentationCount,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lastUpdated: formatLastUpdated(record.updatedAt, now),
    archivedAt: record.archivedAt?.toISOString() ?? null,
  };
}

function missingCounts(db: DatabaseClient): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of db
    .select({ caseId: documentationChecklistItems.caseId })
    .from(documentationChecklistItems)
    .where(eq(documentationChecklistItems.status, 'Missing'))
    .all()) {
    counts.set(item.caseId, (counts.get(item.caseId) ?? 0) + 1);
  }
  return counts;
}

export function listCases(
  db: DatabaseClient = getDatabase(),
  includeArchived = false,
): PriorAuthorizationCase[] {
  const counts = missingCounts(db);
  const now = new Date();
  return db
    .select()
    .from(priorAuthorizationCases)
    .orderBy(desc(priorAuthorizationCases.id))
    .all()
    .filter((record) => includeArchived || !record.archivedAt)
    .map((record) => toCaseDto(record, counts.get(record.id) ?? 0, now));
}

export function countCases(db: DatabaseClient = getDatabase()): number {
  return db
    .select({ id: priorAuthorizationCases.id })
    .from(priorAuthorizationCases)
    .all().length;
}

export function findCaseRecord(
  caseId: string,
  db: DatabaseClient = getDatabase(),
): PriorAuthorizationCaseRecord | undefined {
  return db
    .select()
    .from(priorAuthorizationCases)
    .where(eq(priorAuthorizationCases.id, caseId))
    .get();
}

function toChecklistDto(
  item: DocumentationChecklistItemRecord,
): DocumentationChecklistItem {
  return { ...item, updatedAt: item.updatedAt.toISOString() };
}

function toDocumentDto(
  document: CaseDocumentRecord,
  uploaderName: string | null,
  analyses: CaseDocument['analyses'] = [],
): CaseDocument {
  return {
    id: document.id,
    caseId: document.caseId,
    documentType: document.documentType,
    originalFilename: document.originalFilename,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    uploadedByDisplayName: uploaderName ?? 'Synthetic seed',
    uploadedAt: document.uploadedAt.toISOString(),
    reviewStatus: deriveDocumentReviewStatus(analyses),
    isSynthetic: document.isSynthetic,
    archivedAt: document.archivedAt?.toISOString() ?? null,
    analyses,
  };
}

function toNoteDto(note: CaseNoteRecord, authorName: string | null): CaseNote {
  return {
    id: note.id,
    caseId: note.caseId,
    body: note.body,
    authorDisplayName: authorName ?? 'Synthetic seed',
    createdAt: note.createdAt.toISOString(),
  };
}

export function getCaseDetail(
  caseId: string,
  db: DatabaseClient = getDatabase(),
): CaseDetail | undefined {
  const record = findCaseRecord(caseId, db);
  if (!record) return undefined;

  const checklist = db
    .select()
    .from(documentationChecklistItems)
    .where(eq(documentationChecklistItems.caseId, caseId))
    .orderBy(asc(documentationChecklistItems.sortOrder))
    .all()
    .map(toChecklistDto);

  const analysesByDocument = listDocumentAnalysesForCase(caseId, db);
  const documents = db
    .select({ document: caseDocuments, uploaderName: users.displayName })
    .from(caseDocuments)
    .leftJoin(users, eq(caseDocuments.uploadedByUserId, users.id))
    .where(and(eq(caseDocuments.caseId, caseId), isNull(caseDocuments.archivedAt)))
    .orderBy(desc(caseDocuments.uploadedAt))
    .all()
    .map(({ document, uploaderName }) =>
      toDocumentDto(
        document,
        uploaderName,
        analysesByDocument.get(document.id) ?? [],
      ),
    );

  const notes = db
    .select({ note: caseNotes, authorName: users.displayName })
    .from(caseNotes)
    .leftJoin(users, eq(caseNotes.userId, users.id))
    .where(eq(caseNotes.caseId, caseId))
    .orderBy(desc(caseNotes.createdAt))
    .all()
    .map(({ note, authorName }) => toNoteDto(note, authorName));

  return {
    ...toCaseDto(
      record,
      checklist.filter((item) => item.status === 'Missing').length,
    ),
    checklist,
    documents,
    notes,
    priorAuthDraft: getPriorAuthDraft(caseId, db),
    readiness: getLatestReadiness(caseId, db),
    submission: getSubmissionDetails(caseId, db),
    communications: listCommunications(caseId, db),
    submissionPacket: buildSubmissionPacket({
      ...toCaseDto(record, checklist.filter((item) => item.status === 'Missing').length), checklist, documents, notes,
      priorAuthDraft: getPriorAuthDraft(caseId, db), readiness: getLatestReadiness(caseId, db),
    }),
    appeal: (() => { const denial = getDenial(caseId, db); const comparison = denial ? compareDenialEvidence(denial, { ...toCaseDto(record, checklist.filter((item) => item.status === 'Missing').length), checklist, documents, notes, priorAuthDraft: getPriorAuthDraft(caseId, db), readiness: getLatestReadiness(caseId, db) }) : null; return { denial, findings: comparison?.findings ?? [], readiness: comparison?.readiness ?? 'NEEDS_HUMAN_REVIEW', nextAction: comparison?.nextAction ?? 'Capture the denial reason to begin review.', communications: listCommunications(caseId, db).filter((c) => c.type.startsWith('APPEAL_')) }; })(),
  };
}

export function findCaseDocumentRecord(
  caseId: string,
  documentId: string,
  db: DatabaseClient = getDatabase(),
): CaseDocumentRecord | undefined {
  return db
    .select()
    .from(caseDocuments)
    .where(
      and(eq(caseDocuments.id, documentId), eq(caseDocuments.caseId, caseId)),
    )
    .get();
}

export function updateCaseStatus(
  caseId: string,
  status: CaseStatus,
  db: DatabaseClient = getDatabase(),
): PriorAuthorizationCaseRecord | undefined {
  return db
    .update(priorAuthorizationCases)
    .set({ status, updatedAt: new Date() })
    .where(eq(priorAuthorizationCases.id, caseId))
    .returning()
    .get();
}

export function updateChecklistStatus(
  caseId: string,
  itemId: string,
  status: ChecklistStatus,
  db: DatabaseClient = getDatabase(),
): DocumentationChecklistItem | undefined {
  const now = new Date();
  const updated = db.transaction((transaction) => {
    const item = transaction
      .update(documentationChecklistItems)
      .set({ status, updatedAt: now })
      .where(
        and(
          eq(documentationChecklistItems.id, itemId),
          eq(documentationChecklistItems.caseId, caseId),
        ),
      )
      .returning()
      .get();
    if (item) {
      transaction
        .update(priorAuthorizationCases)
        .set({ updatedAt: now })
        .where(eq(priorAuthorizationCases.id, caseId))
        .run();
    }
    return item;
  });
  return updated ? toChecklistDto(updated) : undefined;
}

export function addCaseNote(
  input: { caseId: string; userId: string; body: string },
  db: DatabaseClient = getDatabase(),
): CaseNote {
  const now = new Date();
  const id = randomUUID();
  const note = db.transaction((transaction) => {
    const created = transaction
      .insert(caseNotes)
      .values({
        id,
        caseId: input.caseId,
        userId: input.userId,
        body: input.body,
        createdAt: now,
      })
      .returning()
      .get();
    transaction
      .update(priorAuthorizationCases)
      .set({ updatedAt: now })
      .where(eq(priorAuthorizationCases.id, input.caseId))
      .run();
    return created;
  });
  const author = db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, input.userId))
    .get();
  return toNoteDto(note, author?.displayName ?? null);
}

export function addCaseDocument(
  input: {
    id: string;
    caseId: string;
    documentType: DocumentationType;
    originalFilename: string;
    storedFilename: string;
    mimeType: string;
    fileSize: number;
    uploadedByUserId: string;
  },
  db: DatabaseClient = getDatabase(),
): CaseDocument {
  const now = new Date();
  const document = db.transaction((transaction) => {
    const created = transaction
      .insert(caseDocuments)
      .values({
        ...input,
        uploadedAt: now,
        reviewStatus: 'Needs Review',
        isSynthetic: true,
      })
      .returning()
      .get();
    transaction
      .update(priorAuthorizationCases)
      .set({ updatedAt: now })
      .where(eq(priorAuthorizationCases.id, input.caseId))
      .run();
    return created;
  });
  const uploader = db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, input.uploadedByUserId))
    .get();
  return toDocumentDto(document, uploader?.displayName ?? null);
}
