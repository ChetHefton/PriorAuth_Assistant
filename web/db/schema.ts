import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import type { UserRole } from '@/types/auth';
import type {
  CasePriority,
  CaseStatus,
  ChecklistStatus,
  DocumentationType,
  DocumentReviewStatus,
} from '@/types/case';
import type {
  DetectedDocumentType,
  ExtractionConfidence,
  ExtractionEvidenceStatus,
  ExtractionFactKey,
  ExtractionReviewDecision,
} from '@/types/extraction';
import type {
  PriorAuthDraftFieldKey,
  PriorAuthDraftFieldStatus,
} from '@/types/prior-auth-draft';
import type {
  PolicyConditionType,
  PolicyMatchStatus,
  PolicyRequirementKind,
  PolicyRequirementLevel,
  PolicySelectionType,
  ReadinessStatus,
  RequirementResultStatus,
} from '@/types/policy';
import type { CommunicationChannel, CommunicationStatus, CommunicationType } from '@/types/communications';
import type { DenialStatus } from '@/types/denial';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    role: text('role').$type<UserRole>().notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [uniqueIndex('idx_users_username').on(table.username)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_sessions_user_id').on(table.userId),
    index('idx_sessions_expires_at').on(table.expiresAt),
  ],
);

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_audit_events_user_id').on(table.userId),
    index('idx_audit_events_resource').on(table.resourceType, table.resourceId),
    index('idx_audit_events_timestamp').on(table.timestamp),
  ],
);

export const priorAuthorizationCases = sqliteTable(
  'prior_authorization_cases',
  {
    id: text('id').primaryKey(),
    patientDisplayName: text('patient_display_name').notNull(),
    patientInitials: text('patient_initials').notNull(),
    requestedEquipment: text('requested_equipment').notNull(),
    equipmentCategory: text('equipment_category').notNull(),
    insurerName: text('insurer_name').notNull(),
    insurerPlan: text('insurer_plan').notNull(),
    status: text('status').$type<CaseStatus>().notNull(),
    priority: text('priority').$type<CasePriority>().notNull(),
    assignedSpecialist: text('assigned_specialist').notNull(),
    followUpDue: text('follow_up_due'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
    archivedByUserId: text('archived_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    submittedAt: integer('submitted_at', { mode: 'timestamp_ms' }),
    submissionChannel: text('submission_channel'),
    externalReferenceNumber: text('external_reference_number'),
    lastFollowUpAt: integer('last_follow_up_at', { mode: 'timestamp_ms' }),
    nextFollowUpAt: integer('next_follow_up_at', { mode: 'timestamp_ms' }),
    submittedByUserId: text('submitted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('idx_prior_authorization_cases_status').on(table.status),
    index('idx_prior_authorization_cases_follow_up_due').on(table.followUpDue),
  ],
);

export const caseCommunications = sqliteTable('case_communications', {
  id: text('id').primaryKey(), caseId: text('case_id').notNull().references(() => priorAuthorizationCases.id,{onDelete:'cascade'}),
  type: text('type').$type<CommunicationType>().notNull(), channel: text('channel').$type<CommunicationChannel>().notNull(), purpose:text('purpose').notNull(),
  generatedContent:text('generated_content').notNull(), editedContent:text('edited_content'), generatedByUserId:text('generated_by_user_id').references(()=>users.id,{onDelete:'set null'}), reviewedByUserId:text('reviewed_by_user_id').references(()=>users.id,{onDelete:'set null'}), status:text('status').$type<CommunicationStatus>().notNull().default('DRAFT'), createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(), updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull()
}, (table)=>[index('idx_case_communications_case_time').on(table.caseId,table.createdAt)]);

export const denialRecords = sqliteTable('denial_records', {
  id:text('id').primaryKey(), caseId:text('case_id').notNull().references(()=>priorAuthorizationCases.id,{onDelete:'cascade'}), denialDocumentId:text('denial_document_id').references(()=>caseDocuments.id,{onDelete:'set null'}), payer:text('payer').notNull(), denialDate:text('denial_date'), externalReferenceNumber:text('external_reference_number'), denialReasonCode:text('denial_reason_code'), denialReasonText:text('denial_reason_text'), appealDeadline:text('appeal_deadline'), appealInstructions:text('appeal_instructions'), status:text('status').$type<DenialStatus>().notNull().default('OPEN'), createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(), updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull()
},(table)=>[index('idx_denial_records_case').on(table.caseId)]);

export const caseIntakes = sqliteTable('case_intakes',{id:text('id').primaryKey(),createdByUserId:text('created_by_user_id').references(()=>users.id,{onDelete:'set null'}),status:text('status').notNull(),fieldsJson:text('fields_json').notNull(),createdCaseId:text('created_case_id'),createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull()});
export const caseIntakeDocuments = sqliteTable('case_intake_documents',{id:text('id').primaryKey(),intakeId:text('intake_id').notNull().references(()=>caseIntakes.id,{onDelete:'cascade'}),originalFilename:text('original_filename').notNull(),storedFilename:text('stored_filename').notNull(),mimeType:text('mime_type').notNull(),fileSize:integer('file_size').notNull(),createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull()});

export const documentationChecklistItems = sqliteTable(
  'documentation_checklist_items',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => priorAuthorizationCases.id, { onDelete: 'cascade' }),
    documentType: text('document_type').$type<DocumentationType>().notNull(),
    label: text('label').notNull(),
    status: text('status').$type<ChecklistStatus>().notNull(),
    sortOrder: integer('sort_order').notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_documentation_checklist_case_type').on(
      table.caseId,
      table.documentType,
    ),
    index('idx_documentation_checklist_case_status').on(
      table.caseId,
      table.status,
    ),
  ],
);

export const caseDocuments = sqliteTable(
  'case_documents',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => priorAuthorizationCases.id, { onDelete: 'cascade' }),
    documentType: text('document_type').$type<DocumentationType>().notNull(),
    originalFilename: text('original_filename').notNull(),
    storedFilename: text('stored_filename').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSize: integer('file_size').notNull(),
    uploadedByUserId: text('uploaded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    uploadedAt: integer('uploaded_at', { mode: 'timestamp_ms' }).notNull(),
    reviewStatus: text('review_status').$type<DocumentReviewStatus>().notNull(),
    isSynthetic: integer('is_synthetic', { mode: 'boolean' })
      .notNull()
      .default(true),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
    archivedByUserId: text('archived_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    uniqueIndex('idx_case_documents_stored_filename').on(table.storedFilename),
    index('idx_case_documents_case_uploaded').on(
      table.caseId,
      table.uploadedAt,
    ),
  ],
);

export const caseNotes = sqliteTable(
  'case_notes',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => priorAuthorizationCases.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    body: text('body').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_case_notes_case_created').on(table.caseId, table.createdAt),
  ],
);

export const documentAnalyses = sqliteTable(
  'document_analyses',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => priorAuthorizationCases.id, { onDelete: 'cascade' }),
    documentId: text('document_id')
      .notNull()
      .references(() => caseDocuments.id, { onDelete: 'cascade' }),
    requestedByUserId: text('requested_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    status: text('status')
      .$type<'PROCESSING' | 'COMPLETED' | 'FAILED'>()
      .notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    detectedDocumentType: text(
      'detected_document_type',
    ).$type<DetectedDocumentType>(),
    classificationConfidence: text(
      'classification_confidence',
    ).$type<ExtractionConfidence>(),
    classificationSourceQuote: text('classification_source_quote'),
    classificationNeedsReview: integer('classification_needs_review', {
      mode: 'boolean',
    })
      .notNull()
      .default(true),
    warningsJson: text('warnings_json').notNull().default('[]'),
    failureCode: text('failure_code'),
    requestedAt: integer('requested_at', { mode: 'timestamp_ms' }).notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('idx_document_analyses_document_requested').on(
      table.documentId,
      table.requestedAt,
    ),
    index('idx_document_analyses_case').on(table.caseId),
  ],
);

export const extractedFacts = sqliteTable(
  'extracted_facts',
  {
    id: text('id').primaryKey(),
    analysisId: text('analysis_id')
      .notNull()
      .references(() => documentAnalyses.id, { onDelete: 'cascade' }),
    fieldKey: text('field_key').$type<ExtractionFactKey>().notNull(),
    originalValue: text('original_value'),
    confidence: text('confidence').$type<ExtractionConfidence>().notNull(),
    evidenceStatus: text('evidence_status')
      .$type<ExtractionEvidenceStatus>()
      .notNull(),
    sourceQuote: text('source_quote'),
    sourceDocumentId: text('source_document_id')
      .notNull()
      .references(() => caseDocuments.id, { onDelete: 'cascade' }),
    uncertaintyNote: text('uncertainty_note'),
    reviewDecision: text('review_decision')
      .$type<ExtractionReviewDecision>()
      .notNull()
      .default('PENDING'),
    reviewedValue: text('reviewed_value'),
    reviewedByUserId: text('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_extracted_facts_analysis_field').on(
      table.analysisId,
      table.fieldKey,
    ),
    index('idx_extracted_facts_source_document').on(table.sourceDocumentId),
    index('idx_extracted_facts_review').on(table.reviewDecision),
  ],
);

export const priorAuthDrafts = sqliteTable(
  'prior_auth_drafts',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => priorAuthorizationCases.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull().default(1),
    notesJson: text('notes_json').notNull(),
    summaryProvider: text('summary_provider').notNull(),
    summaryModel: text('summary_model').notNull(),
    generatedByUserId: text('generated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    generatedAt: integer('generated_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [uniqueIndex('idx_prior_auth_drafts_case').on(table.caseId)],
);

export const priorAuthDraftFields = sqliteTable(
  'prior_auth_draft_fields',
  {
    id: text('id').primaryKey(),
    draftId: text('draft_id')
      .notNull()
      .references(() => priorAuthDrafts.id, { onDelete: 'cascade' }),
    fieldKey: text('field_key').$type<PriorAuthDraftFieldKey>().notNull(),
    status: text('status').$type<PriorAuthDraftFieldStatus>().notNull(),
    aiProposedValue: text('ai_proposed_value'),
    humanVerifiedValue: text('human_verified_value'),
    editedByUserId: text('edited_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    editedAt: integer('edited_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_prior_auth_draft_fields_draft_key').on(
      table.draftId,
      table.fieldKey,
    ),
    index('idx_prior_auth_draft_fields_status').on(table.draftId, table.status),
  ],
);

export const priorAuthDraftFieldSources = sqliteTable(
  'prior_auth_draft_field_sources',
  {
    id: text('id').primaryKey(),
    draftFieldId: text('draft_field_id')
      .notNull()
      .references(() => priorAuthDraftFields.id, { onDelete: 'cascade' }),
    extractedFactId: text('extracted_fact_id')
      .notNull()
      .references(() => extractedFacts.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('idx_prior_auth_draft_field_sources_unique').on(
      table.draftFieldId,
      table.extractedFactId,
    ),
    index('idx_prior_auth_draft_field_sources_fact').on(table.extractedFactId),
  ],
);

export const payers = sqliteTable(
  'payers',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    planName: text('plan_name').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [
    uniqueIndex('idx_payers_name_plan').on(table.name, table.planName),
    index('idx_payers_active').on(table.isActive),
  ],
);

export const payerPolicies = sqliteTable(
  'payer_policies',
  {
    id: text('id').primaryKey(),
    payerId: text('payer_id')
      .notNull()
      .references(() => payers.id, { onDelete: 'cascade' }),
    policyName: text('policy_name').notNull(),
    equipmentCategory: text('equipment_category').notNull(),
    hcpcsCodesJson: text('hcpcs_codes_json').notNull().default('[]'),
    effectiveDate: text('effective_date').notNull(),
    expirationDate: text('expiration_date'),
    submissionChannel: text('submission_channel').notNull(),
    followUpIntervalDays: integer('follow_up_interval_days'),
    sourceType: text('source_type').notNull(),
    sourceReference: text('source_reference').notNull(),
    notes: text('notes').notNull().default(''),
    version: text('version').notNull(),
    isSynthetic: integer('is_synthetic', { mode: 'boolean' })
      .notNull()
      .default(true),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [
    index('idx_payer_policies_payer_active').on(table.payerId, table.isActive),
    index('idx_payer_policies_category').on(table.equipmentCategory),
  ],
);

export const policyRequirements = sqliteTable(
  'policy_requirements',
  {
    id: text('id').primaryKey(),
    policyId: text('policy_id')
      .notNull()
      .references(() => payerPolicies.id, { onDelete: 'cascade' }),
    requirementKey: text('requirement_key').notNull(),
    label: text('label').notNull(),
    kind: text('kind').$type<PolicyRequirementKind>().notNull(),
    documentType: text('document_type').$type<DocumentationType>(),
    fieldKey: text('field_key'),
    conditionType: text('condition_type')
      .$type<PolicyConditionType>()
      .notNull()
      .default('ALWAYS'),
    conditionValue: text('condition_value'),
    requirementLevel: text('requirement_level')
      .$type<PolicyRequirementLevel>()
      .notNull()
      .default('REQUIRED'),
    explanation: text('explanation').notNull(),
    blocksReadiness: integer('blocks_readiness', { mode: 'boolean' })
      .notNull()
      .default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    uniqueIndex('idx_policy_requirements_policy_key').on(
      table.policyId,
      table.requirementKey,
    ),
    index('idx_policy_requirements_policy_order').on(
      table.policyId,
      table.sortOrder,
    ),
  ],
);

export const casePolicySelections = sqliteTable(
  'case_policy_selections',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => priorAuthorizationCases.id, { onDelete: 'cascade' }),
    policyId: text('policy_id')
      .notNull()
      .references(() => payerPolicies.id, { onDelete: 'cascade' }),
    selectionType: text('selection_type')
      .$type<PolicySelectionType>()
      .notNull(),
    selectedByUserId: text('selected_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    selectedAt: integer('selected_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_case_policy_selections_case').on(table.caseId),
    index('idx_case_policy_selections_policy').on(table.policyId),
  ],
);

export const readinessEvaluations = sqliteTable(
  'readiness_evaluations',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => priorAuthorizationCases.id, { onDelete: 'cascade' }),
    policyId: text('policy_id').references(() => payerPolicies.id, {
      onDelete: 'set null',
    }),
    policyMatchStatus: text('policy_match_status')
      .$type<PolicyMatchStatus>()
      .notNull(),
    policyMatchReason: text('policy_match_reason').notNull(),
    selectionType: text('selection_type').$type<PolicySelectionType>(),
    status: text('status').$type<ReadinessStatus>().notNull(),
    satisfiedCount: integer('satisfied_count').notNull(),
    applicableCount: integer('applicable_count').notNull(),
    nextBestAction: text('next_best_action').notNull(),
    evaluatedByUserId: text('evaluated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    evaluatedAt: integer('evaluated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_readiness_evaluations_case_time').on(
      table.caseId,
      table.evaluatedAt,
    ),
  ],
);

export const readinessRequirementResults = sqliteTable(
  'readiness_requirement_results',
  {
    id: text('id').primaryKey(),
    evaluationId: text('evaluation_id')
      .notNull()
      .references(() => readinessEvaluations.id, { onDelete: 'cascade' }),
    requirementId: text('requirement_id')
      .notNull()
      .references(() => policyRequirements.id, { onDelete: 'cascade' }),
    requirementKey: text('requirement_key').notNull(),
    label: text('label').notNull(),
    status: text('status').$type<RequirementResultStatus>().notNull(),
    reason: text('reason').notNull(),
    sourceDocumentIdsJson: text('source_document_ids_json')
      .notNull()
      .default('[]'),
    sourceFieldKeysJson: text('source_field_keys_json').notNull().default('[]'),
    explanation: text('explanation').notNull(),
    blocksReadiness: integer('blocks_readiness', { mode: 'boolean' })
      .notNull()
      .default(true),
  },
  (table) => [
    uniqueIndex('idx_readiness_results_evaluation_requirement').on(
      table.evaluationId,
      table.requirementId,
    ),
    index('idx_readiness_results_status').on(table.evaluationId, table.status),
  ],
);

export type UserRecord = typeof users.$inferSelect;
export type NewUserRecord = typeof users.$inferInsert;
export type SessionRecord = typeof sessions.$inferSelect;
export type AuditEventRecord = typeof auditEvents.$inferSelect;
export type PriorAuthorizationCaseRecord =
  typeof priorAuthorizationCases.$inferSelect;
export type DocumentationChecklistItemRecord =
  typeof documentationChecklistItems.$inferSelect;
export type CaseDocumentRecord = typeof caseDocuments.$inferSelect;
export type CaseNoteRecord = typeof caseNotes.$inferSelect;
export type DocumentAnalysisRecord = typeof documentAnalyses.$inferSelect;
export type ExtractedFactRecord = typeof extractedFacts.$inferSelect;
export type PriorAuthDraftRecord = typeof priorAuthDrafts.$inferSelect;
export type PriorAuthDraftFieldRecord = typeof priorAuthDraftFields.$inferSelect;
export type PayerRecord = typeof payers.$inferSelect;
export type PayerPolicyRecord = typeof payerPolicies.$inferSelect;
export type PolicyRequirementRecord = typeof policyRequirements.$inferSelect;
export type CasePolicySelectionRecord = typeof casePolicySelections.$inferSelect;
export type ReadinessEvaluationRecord = typeof readinessEvaluations.$inferSelect;
export type CaseCommunicationRecord = typeof caseCommunications.$inferSelect;
export type DenialRecord = typeof denialRecords.$inferSelect;
