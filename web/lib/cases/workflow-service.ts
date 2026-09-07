import { recordAuditEvent } from '@/db/repositories/audit-events';
import {
  addCaseDocument,
  addCaseNote,
  updateCaseStatus,
  updateChecklistStatus,
} from '@/db/repositories/cases';
import type { DatabaseClient } from '@/db/client';
import type {
  CaseStatus,
  ChecklistStatus,
  DocumentationType,
} from '@/types/case';

export function changeCaseStatus(
  caseId: string,
  status: CaseStatus,
  actorUserId: string,
  db?: DatabaseClient,
) {
  const updated = updateCaseStatus(caseId, status, db);
  if (updated) {
    recordAuditEvent(
      {
        userId: actorUserId,
        action: 'case.status_changed',
        resourceType: 'case',
        resourceId: caseId,
      },
      db,
    );
  }
  return updated;
}

export function changeChecklistStatus(
  caseId: string,
  itemId: string,
  status: ChecklistStatus,
  actorUserId: string,
  db?: DatabaseClient,
) {
  const item = updateChecklistStatus(caseId, itemId, status, db);
  if (item) {
    recordAuditEvent(
      {
        userId: actorUserId,
        action: 'case.checklist_updated',
        resourceType: 'case',
        resourceId: caseId,
      },
      db,
    );
  }
  return item;
}

export function createCaseNote(
  caseId: string,
  body: string,
  actorUserId: string,
  db?: DatabaseClient,
) {
  const note = addCaseNote({ caseId, userId: actorUserId, body }, db);
  recordAuditEvent(
    {
      userId: actorUserId,
      action: 'case.note_added',
      resourceType: 'case',
      resourceId: caseId,
    },
    db,
  );
  return note;
}

export function registerCaseDocument(
  input: {
    id: string;
    caseId: string;
    documentType: DocumentationType;
    originalFilename: string;
    storedFilename: string;
    mimeType: string;
    fileSize: number;
  },
  actorUserId: string,
  db?: DatabaseClient,
) {
  const document = addCaseDocument(
    { ...input, uploadedByUserId: actorUserId },
    db,
  );
  recordAuditEvent(
    {
      userId: actorUserId,
      action: 'case.document_uploaded',
      resourceType: 'case',
      resourceId: input.caseId,
    },
    db,
  );
  return document;
}
