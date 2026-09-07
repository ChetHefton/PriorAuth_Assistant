import { randomUUID } from 'node:crypto';
import { copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';

import type { DatabaseClient } from '@/db/client';
import { caseDocuments, caseIntakeDocuments, caseIntakes, priorAuthorizationCases } from '@/db/schema';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { nextCanonicalCaseId } from '@/lib/cases/canonical-id';

type IntakeField = { key: string; value: unknown };
type CopyFile = (source: string, target: string) => Promise<void>;

function documentTypeFor(filename: string) {
  const name = filename.toLowerCase();
  if (name.includes('demographic')) return 'PATIENT_DEMOGRAPHICS' as const;
  if (name.includes('insurance')) return 'INSURANCE_INFORMATION' as const;
  if (name.includes('physician') || name.includes('order')) return 'PHYSICIAN_ORDER' as const;
  if (name.includes('clinical') || name.includes('chart')) return 'CLINICAL_CHART_NOTES' as const;
  if (name.includes('pt') || name.includes('ot') || name.includes('evaluation')) return 'PT_OT_EVALUATION' as const;
  if (name.includes('equipment')) return 'EQUIPMENT_SPECIFICATION' as const;
  return 'OTHER' as const;
}

export async function promoteIntakeToCase(input: {
  db: DatabaseClient;
  intakeId: string;
  fields: IntakeField[];
  userId: string;
  userDisplayName: string;
  assignToSelf?: boolean;
  copy?: CopyFile;
  remove?: (target: string) => Promise<void>;
}): Promise<string> {
  const copy = input.copy ?? copyFile;
  const remove = input.remove ?? (async (target: string) => { await rm(target, { force: true }); });
  const get = (key: string) => {
    const value = input.fields.find((field) => field.key === key)?.value;
    return typeof value === 'string' ? value.trim() : '';
  };
  const caseId = nextCanonicalCaseId(input.db);
  const now = new Date();
  const intakeDocuments = input.db.select().from(caseIntakeDocuments).where(eq(caseIntakeDocuments.intakeId, input.intakeId)).all();
  const promoted: Array<{ documentId: string; permanentName: string; originalFilename: string; documentType: ReturnType<typeof documentTypeFor>; mimeType: string; fileSize: number }> = [];
  try {
    for (const document of intakeDocuments) {
      const documentId = randomUUID();
      const permanentName = `${documentId}-${document.originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      await copy(path.join(/* turbopackIgnore: true */ process.cwd(), document.storedFilename), path.join(process.cwd(), 'data', 'local', 'uploads', permanentName));
      promoted.push({ documentId, permanentName, originalFilename: document.originalFilename, documentType: documentTypeFor(document.originalFilename), mimeType: document.mimeType, fileSize: document.fileSize });
    }
    input.db.transaction((transaction) => {
      transaction.insert(priorAuthorizationCases).values({ id: caseId, patientDisplayName: get('patientName') || 'New synthetic patient', patientInitials: get('patientName').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'NP', requestedEquipment: get('requestedEquipment') || 'Equipment to be reviewed', equipmentCategory: 'DME', insurerName: get('payer') || 'Unknown payer', insurerPlan: get('plan') || 'Unknown plan', status: 'Draft', priority: 'Routine', assignedSpecialist: input.assignToSelf ? input.userDisplayName : 'Unassigned', followUpDue: null, createdAt: now, updatedAt: now }).run();
      for (const document of promoted) transaction.insert(caseDocuments).values({ id: document.documentId, caseId, documentType: document.documentType, originalFilename: document.originalFilename, storedFilename: document.permanentName, mimeType: document.mimeType, fileSize: document.fileSize, uploadedByUserId: input.userId, uploadedAt: now, reviewStatus: 'Needs Review', isSynthetic: true }).run();
      transaction.update(caseIntakes).set({ status: 'CREATED', createdCaseId: caseId, fieldsJson: JSON.stringify(input.fields) }).where(eq(caseIntakes.id, input.intakeId)).run();
      recordAuditEvent({ userId: input.userId, action: 'case.created_from_document_intake', resourceType: 'case', resourceId: caseId }, transaction);
    });
    return caseId;
  } catch (error) {
    await Promise.all(promoted.map((document) => remove(path.join(process.cwd(), 'data', 'local', 'uploads', document.permanentName))));
    throw error;
  }
}
