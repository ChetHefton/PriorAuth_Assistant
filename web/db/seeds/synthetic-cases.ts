import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type BetterSqlite3 from 'better-sqlite3';

import {
  syntheticCaseSeeds,
  syntheticDocumentSeeds,
  syntheticNoteSeeds,
} from '@/data/synthetic-cases';
import { documentationTypeLabels, documentationTypes } from '@/types/case';

export function seedSyntheticCaseData(
  sqlite: BetterSqlite3.Database,
  databasePath: string,
): void {
  const uploadDirectory = path.join(path.dirname(databasePath), 'uploads');
  mkdirSync(uploadDirectory, { recursive: true });

  const insertCase = sqlite.prepare(`
    INSERT OR IGNORE INTO prior_authorization_cases (
      id, patient_display_name, patient_initials, requested_equipment, equipment_category,
      insurer_name, insurer_plan, status, priority, assigned_specialist, follow_up_due,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertChecklistItem = sqlite.prepare(`
    INSERT OR IGNORE INTO documentation_checklist_items (
      id, case_id, document_type, label, status, sort_order, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertDocument = sqlite.prepare(`
    INSERT OR IGNORE INTO case_documents (
      id, case_id, document_type, original_filename, stored_filename, mime_type,
      file_size, uploaded_by_user_id, uploaded_at, review_status, is_synthetic
    ) VALUES (?, ?, ?, ?, ?, 'text/plain', ?, NULL, ?, ?, 1)
  `);
  const insertNote = sqlite.prepare(`
    INSERT OR IGNORE INTO case_notes (id, case_id, user_id, body, created_at)
    VALUES (?, ?, NULL, ?, ?)
  `);

  const seed = sqlite.transaction(() => {
    for (const caseSeed of syntheticCaseSeeds) {
      const updatedAt = new Date(caseSeed.updatedAt).getTime();
      insertCase.run(
        caseSeed.id,
        caseSeed.patientDisplayName,
        caseSeed.patientInitials,
        caseSeed.requestedEquipment,
        caseSeed.equipmentCategory,
        caseSeed.insurerName,
        caseSeed.insurerPlan,
        caseSeed.status,
        caseSeed.priority,
        caseSeed.assignedSpecialist,
        caseSeed.followUpDue,
        new Date(caseSeed.createdAt).getTime(),
        updatedAt,
      );

      documentationTypes.forEach((documentType, index) => {
        insertChecklistItem.run(
          `${caseSeed.id}:${documentType}`,
          caseSeed.id,
          documentType,
          documentationTypeLabels[documentType],
          caseSeed.checklistOverrides[documentType] ?? 'Received',
          index,
          updatedAt,
        );
      });
    }

    for (const document of syntheticDocumentSeeds) {
      const bytes = Buffer.from(document.content, 'utf8');
      insertDocument.run(
        document.id,
        document.caseId,
        document.documentType,
        document.originalFilename,
        document.storedFilename,
        bytes.byteLength,
        new Date('2026-09-05T14:30:00.000Z').getTime(),
        document.reviewStatus,
      );
    }

    for (const note of syntheticNoteSeeds) {
      insertNote.run(
        note.id,
        note.caseId,
        note.body,
        new Date(note.createdAt).getTime(),
      );
    }
  });

  seed();

  sqlite.prepare(`INSERT OR IGNORE INTO denial_records (id, case_id, denial_document_id, payer, denial_date, external_reference_number, denial_reason_code, denial_reason_text, appeal_deadline, appeal_instructions, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'demo-denial-rm-pa-1042', 'RM-PA-1042', '4e2e7ac4-f42f-4acd-af67-8ab18ccdb105', 'SummitCare Advantage', '2026-08-18', 'SYN-REF-1042', 'DOC-ACCESSORY', 'Documentation does not include sufficient justification for the requested accessory.', '2026-09-24', 'Submit written reconsideration with supporting documentation through the configured demonstration channel.', 'ANALYZED', Date.now(), Date.now(),
  );

  for (const document of syntheticDocumentSeeds) {
    const storedPath = path.join(uploadDirectory, document.storedFilename);
    if (!existsSync(storedPath)) {
      writeFileSync(storedPath, document.content, {
        encoding: 'utf8',
        flag: 'wx',
      });
    }
  }
}
