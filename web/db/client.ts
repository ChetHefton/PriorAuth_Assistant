import { mkdirSync } from 'node:fs';
import { rmSync } from 'node:fs';
import path from 'node:path';

import BetterSqlite3 from 'better-sqlite3';
import {
  drizzle,
  type BetterSQLite3Database,
} from 'drizzle-orm/better-sqlite3';

import * as schema from '@/db/schema';
import { seedSyntheticCaseData } from '@/db/seeds/synthetic-cases';
import { seedSyntheticPolicies } from '@/db/seeds/synthetic-policies';

export type DatabaseClient = BetterSQLite3Database<typeof schema>;

type DatabaseState = {
  sqlite: BetterSqlite3.Database;
  db: DatabaseClient;
};

const globalDatabase = globalThis as typeof globalThis & {
  priorAuthDatabase?: DatabaseState;
};

function resolveDatabasePath(): string {
  const configuredFilename =
    process.env.DATABASE_FILENAME?.trim() || 'prior-auth.db';
  if (path.basename(configuredFilename) !== configuredFilename) {
    throw new Error(
      'DATABASE_FILENAME must be a filename without directory segments.',
    );
  }
  return path.join(process.cwd(), 'data', 'local', configuredFilename);
}

function initializeSchema(sqlite: BetterSqlite3.Database): void {
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN', 'AUTHORIZATION_SPECIALIST', 'SUPERVISOR', 'AUDITOR')),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      timestamp INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events(resource_type, resource_id);
    CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events(timestamp);

    CREATE TABLE IF NOT EXISTS prior_authorization_cases (
      id TEXT PRIMARY KEY NOT NULL,
      patient_display_name TEXT NOT NULL,
      patient_initials TEXT NOT NULL,
      requested_equipment TEXT NOT NULL,
      equipment_category TEXT NOT NULL,
      insurer_name TEXT NOT NULL,
      insurer_plan TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Draft', 'Needs Documentation', 'Ready for Submission', 'Submitted', 'Pending', 'Additional Info Requested', 'Approved', 'Denied', 'Appeal Drafting', 'Appeal Submitted', 'Closed')),
      priority TEXT NOT NULL CHECK (priority IN ('Routine', 'High', 'Urgent')),
      assigned_specialist TEXT NOT NULL,
      follow_up_due TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      archived_at INTEGER,
      archived_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_prior_authorization_cases_status ON prior_authorization_cases(status);
    CREATE INDEX IF NOT EXISTS idx_prior_authorization_cases_follow_up_due ON prior_authorization_cases(follow_up_due);
    CREATE TABLE IF NOT EXISTS case_communications (
      id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES prior_authorization_cases(id) ON DELETE CASCADE,
      type TEXT NOT NULL, channel TEXT NOT NULL, purpose TEXT NOT NULL, generated_content TEXT NOT NULL,
      edited_content TEXT, generated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, status TEXT NOT NULL DEFAULT 'DRAFT',
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_case_communications_case_time ON case_communications(case_id, created_at);
    CREATE TABLE IF NOT EXISTS denial_records (
      id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES prior_authorization_cases(id) ON DELETE CASCADE,
      denial_document_id TEXT REFERENCES case_documents(id) ON DELETE SET NULL, payer TEXT NOT NULL,
      denial_date TEXT, external_reference_number TEXT, denial_reason_code TEXT, denial_reason_text TEXT,
      appeal_deadline TEXT, appeal_instructions TEXT, status TEXT NOT NULL DEFAULT 'OPEN', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_denial_records_case ON denial_records(case_id);
    CREATE TABLE IF NOT EXISTS case_intakes (id TEXT PRIMARY KEY NOT NULL, created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, status TEXT NOT NULL, fields_json TEXT NOT NULL, created_case_id TEXT, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS case_intake_documents (id TEXT PRIMARY KEY NOT NULL, intake_id TEXT NOT NULL REFERENCES case_intakes(id) ON DELETE CASCADE, original_filename TEXT NOT NULL, stored_filename TEXT NOT NULL, mime_type TEXT NOT NULL, file_size INTEGER NOT NULL, created_at INTEGER NOT NULL);

    CREATE TABLE IF NOT EXISTS documentation_checklist_items (
      id TEXT PRIMARY KEY NOT NULL,
      case_id TEXT NOT NULL REFERENCES prior_authorization_cases(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL,
      label TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Received', 'Missing', 'Needs Review', 'Not Required')),
      sort_order INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_documentation_checklist_case_type ON documentation_checklist_items(case_id, document_type);
    CREATE INDEX IF NOT EXISTS idx_documentation_checklist_case_status ON documentation_checklist_items(case_id, status);

    CREATE TABLE IF NOT EXISTS case_documents (
      id TEXT PRIMARY KEY NOT NULL,
      case_id TEXT NOT NULL REFERENCES prior_authorization_cases(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      stored_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL CHECK (file_size > 0),
      uploaded_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      uploaded_at INTEGER NOT NULL,
      review_status TEXT NOT NULL CHECK (review_status IN ('Needs Review', 'Reviewed')),
      is_synthetic INTEGER NOT NULL DEFAULT 1 CHECK (is_synthetic IN (0, 1))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_case_documents_stored_filename ON case_documents(stored_filename);
    CREATE INDEX IF NOT EXISTS idx_case_documents_case_uploaded ON case_documents(case_id, uploaded_at);

    CREATE TABLE IF NOT EXISTS case_notes (
      id TEXT PRIMARY KEY NOT NULL,
      case_id TEXT NOT NULL REFERENCES prior_authorization_cases(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_case_notes_case_created ON case_notes(case_id, created_at);

    CREATE TABLE IF NOT EXISTS document_analyses (
      id TEXT PRIMARY KEY NOT NULL,
      case_id TEXT NOT NULL REFERENCES prior_authorization_cases(id) ON DELETE CASCADE,
      document_id TEXT NOT NULL REFERENCES case_documents(id) ON DELETE CASCADE,
      requested_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      detected_document_type TEXT,
      classification_confidence TEXT CHECK (classification_confidence IS NULL OR classification_confidence IN ('HIGH', 'MEDIUM', 'LOW')),
      classification_source_quote TEXT,
      classification_needs_review INTEGER NOT NULL DEFAULT 1 CHECK (classification_needs_review IN (0, 1)),
      warnings_json TEXT NOT NULL DEFAULT '[]',
      failure_code TEXT,
      requested_at INTEGER NOT NULL,
      completed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_document_analyses_document_requested ON document_analyses(document_id, requested_at);
    CREATE INDEX IF NOT EXISTS idx_document_analyses_case ON document_analyses(case_id);

    CREATE TABLE IF NOT EXISTS extracted_facts (
      id TEXT PRIMARY KEY NOT NULL,
      analysis_id TEXT NOT NULL REFERENCES document_analyses(id) ON DELETE CASCADE,
      field_key TEXT NOT NULL,
      original_value TEXT,
      confidence TEXT NOT NULL CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
      evidence_status TEXT NOT NULL CHECK (evidence_status IN ('SUPPORTED', 'NEEDS_REVIEW', 'CONTRADICTORY', 'NOT_FOUND')),
      source_quote TEXT,
      source_document_id TEXT NOT NULL REFERENCES case_documents(id) ON DELETE CASCADE,
      uncertainty_note TEXT,
      review_decision TEXT NOT NULL DEFAULT 'PENDING' CHECK (review_decision IN ('PENDING', 'ACCEPTED', 'EDITED', 'REJECTED')),
      reviewed_value TEXT,
      reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_extracted_facts_analysis_field ON extracted_facts(analysis_id, field_key);
    CREATE INDEX IF NOT EXISTS idx_extracted_facts_source_document ON extracted_facts(source_document_id);
    CREATE INDEX IF NOT EXISTS idx_extracted_facts_review ON extracted_facts(review_decision);

    CREATE TABLE IF NOT EXISTS prior_auth_drafts (
      id TEXT PRIMARY KEY NOT NULL,
      case_id TEXT NOT NULL REFERENCES prior_authorization_cases(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL DEFAULT 1,
      notes_json TEXT NOT NULL,
      summary_provider TEXT NOT NULL,
      summary_model TEXT NOT NULL,
      generated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      generated_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_prior_auth_drafts_case ON prior_auth_drafts(case_id);

    CREATE TABLE IF NOT EXISTS prior_auth_draft_fields (
      id TEXT PRIMARY KEY NOT NULL,
      draft_id TEXT NOT NULL REFERENCES prior_auth_drafts(id) ON DELETE CASCADE,
      field_key TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('MISSING', 'AUTO_POPULATED', 'NEEDS_REVIEW', 'CONFLICT', 'VERIFIED')),
      ai_proposed_value TEXT,
      human_verified_value TEXT,
      edited_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      edited_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_prior_auth_draft_fields_draft_key ON prior_auth_draft_fields(draft_id, field_key);
    CREATE INDEX IF NOT EXISTS idx_prior_auth_draft_fields_status ON prior_auth_draft_fields(draft_id, status);

    CREATE TABLE IF NOT EXISTS prior_auth_draft_field_sources (
      id TEXT PRIMARY KEY NOT NULL,
      draft_field_id TEXT NOT NULL REFERENCES prior_auth_draft_fields(id) ON DELETE CASCADE,
      extracted_fact_id TEXT NOT NULL REFERENCES extracted_facts(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_prior_auth_draft_field_sources_unique ON prior_auth_draft_field_sources(draft_field_id, extracted_fact_id);
    CREATE INDEX IF NOT EXISTS idx_prior_auth_draft_field_sources_fact ON prior_auth_draft_field_sources(extracted_fact_id);

    CREATE TABLE IF NOT EXISTS payers (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payers_name_plan ON payers(name, plan_name);
    CREATE INDEX IF NOT EXISTS idx_payers_active ON payers(is_active);

    CREATE TABLE IF NOT EXISTS payer_policies (
      id TEXT PRIMARY KEY NOT NULL,
      payer_id TEXT NOT NULL REFERENCES payers(id) ON DELETE CASCADE,
      policy_name TEXT NOT NULL,
      equipment_category TEXT NOT NULL,
      hcpcs_codes_json TEXT NOT NULL DEFAULT '[]',
      effective_date TEXT NOT NULL,
      expiration_date TEXT,
      submission_channel TEXT NOT NULL,
      follow_up_interval_days INTEGER,
      source_type TEXT NOT NULL,
      source_reference TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      version TEXT NOT NULL,
      is_synthetic INTEGER NOT NULL DEFAULT 1 CHECK (is_synthetic IN (0, 1)),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
    );
    CREATE INDEX IF NOT EXISTS idx_payer_policies_payer_active ON payer_policies(payer_id, is_active);
    CREATE INDEX IF NOT EXISTS idx_payer_policies_category ON payer_policies(equipment_category);

    CREATE TABLE IF NOT EXISTS policy_requirements (
      id TEXT PRIMARY KEY NOT NULL,
      policy_id TEXT NOT NULL REFERENCES payer_policies(id) ON DELETE CASCADE,
      requirement_key TEXT NOT NULL,
      label TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('DOCUMENT', 'FIELD')),
      document_type TEXT,
      field_key TEXT,
      condition_type TEXT NOT NULL DEFAULT 'ALWAYS' CHECK (condition_type IN ('ALWAYS', 'EQUIPMENT_CATEGORY_IS', 'EQUIPMENT_CONTAINS', 'HCPCS_CODE_PRESENT')),
      condition_value TEXT,
      requirement_level TEXT NOT NULL DEFAULT 'REQUIRED' CHECK (requirement_level IN ('REQUIRED', 'ADVISORY')),
      explanation TEXT NOT NULL,
      blocks_readiness INTEGER NOT NULL DEFAULT 1 CHECK (blocks_readiness IN (0, 1)),
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_requirements_policy_key ON policy_requirements(policy_id, requirement_key);
    CREATE INDEX IF NOT EXISTS idx_policy_requirements_policy_order ON policy_requirements(policy_id, sort_order);

    CREATE TABLE IF NOT EXISTS case_policy_selections (
      id TEXT PRIMARY KEY NOT NULL,
      case_id TEXT NOT NULL REFERENCES prior_authorization_cases(id) ON DELETE CASCADE,
      policy_id TEXT NOT NULL REFERENCES payer_policies(id) ON DELETE CASCADE,
      selection_type TEXT NOT NULL CHECK (selection_type IN ('AUTOMATIC', 'MANUAL')),
      selected_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      selected_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_case_policy_selections_case ON case_policy_selections(case_id);
    CREATE INDEX IF NOT EXISTS idx_case_policy_selections_policy ON case_policy_selections(policy_id);

    CREATE TABLE IF NOT EXISTS readiness_evaluations (
      id TEXT PRIMARY KEY NOT NULL,
      case_id TEXT NOT NULL REFERENCES prior_authorization_cases(id) ON DELETE CASCADE,
      policy_id TEXT REFERENCES payer_policies(id) ON DELETE SET NULL,
      policy_match_status TEXT NOT NULL CHECK (policy_match_status IN ('MATCHED', 'NO_MATCH', 'AMBIGUOUS', 'INSUFFICIENT_DATA')),
      policy_match_reason TEXT NOT NULL,
      selection_type TEXT CHECK (selection_type IS NULL OR selection_type IN ('AUTOMATIC', 'MANUAL')),
      status TEXT NOT NULL CHECK (status IN ('READY_FOR_SPECIALIST_REVIEW', 'MISSING_DOCUMENTATION', 'NEEDS_HUMAN_REVIEW', 'POLICY_MATCH_UNCLEAR', 'CONFLICT_DETECTED')),
      satisfied_count INTEGER NOT NULL,
      applicable_count INTEGER NOT NULL,
      next_best_action TEXT NOT NULL,
      evaluated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      evaluated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_readiness_evaluations_case_time ON readiness_evaluations(case_id, evaluated_at);

    CREATE TABLE IF NOT EXISTS readiness_requirement_results (
      id TEXT PRIMARY KEY NOT NULL,
      evaluation_id TEXT NOT NULL REFERENCES readiness_evaluations(id) ON DELETE CASCADE,
      requirement_id TEXT NOT NULL REFERENCES policy_requirements(id) ON DELETE CASCADE,
      requirement_key TEXT NOT NULL,
      label TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('PRESENT', 'MISSING', 'NEEDS_REVIEW', 'CONFLICT', 'NOT_APPLICABLE')),
      reason TEXT NOT NULL,
      source_document_ids_json TEXT NOT NULL DEFAULT '[]',
      source_field_keys_json TEXT NOT NULL DEFAULT '[]',
      explanation TEXT NOT NULL,
      blocks_readiness INTEGER NOT NULL DEFAULT 1 CHECK (blocks_readiness IN (0, 1))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_readiness_results_evaluation_requirement ON readiness_requirement_results(evaluation_id, requirement_id);
    CREATE INDEX IF NOT EXISTS idx_readiness_results_status ON readiness_requirement_results(evaluation_id, status);
  `);

  // Keep developer databases created during an in-progress prototype upgrade usable.
  // Fresh databases receive these columns from the CREATE TABLE statement above.
  const draftColumns = new Set(
    (
      sqlite.prepare('PRAGMA table_info(prior_auth_drafts)').all() as Array<{
        name: string;
      }>
    ).map((column) => column.name),
  );
  if (!draftColumns.has('summary_provider')) {
    sqlite.exec(
      "ALTER TABLE prior_auth_drafts ADD COLUMN summary_provider TEXT NOT NULL DEFAULT 'unknown'",
    );
  }
  if (!draftColumns.has('summary_model')) {
    sqlite.exec(
      "ALTER TABLE prior_auth_drafts ADD COLUMN summary_model TEXT NOT NULL DEFAULT 'unknown'",
    );
  }
  const policyColumns = new Set(
    (
      sqlite.prepare('PRAGMA table_info(payer_policies)').all() as Array<{
        name: string;
      }>
    ).map((column) => column.name),
  );
  if (!policyColumns.has('follow_up_interval_days')) {
    sqlite.exec('ALTER TABLE payer_policies ADD COLUMN follow_up_interval_days INTEGER');
  }
  const caseColumns = new Set((sqlite.prepare('PRAGMA table_info(prior_authorization_cases)').all() as Array<{name:string}>).map((c)=>c.name));
  for (const [name, sql] of Object.entries({submitted_at:'INTEGER', submission_channel:'TEXT', external_reference_number:'TEXT', last_follow_up_at:'INTEGER', next_follow_up_at:'INTEGER', submitted_by_user_id:'TEXT'})) {
    if (!caseColumns.has(name)) sqlite.exec(`ALTER TABLE prior_authorization_cases ADD COLUMN ${name} ${sql}`);
  }
  if (!caseColumns.has('archived_at')) sqlite.exec('ALTER TABLE prior_authorization_cases ADD COLUMN archived_at INTEGER');
  if (!caseColumns.has('archived_by_user_id')) sqlite.exec('ALTER TABLE prior_authorization_cases ADD COLUMN archived_by_user_id TEXT');
  const documentColumns = new Set((sqlite.prepare('PRAGMA table_info(case_documents)').all() as Array<{name:string}>).map((c)=>c.name));
  if (!documentColumns.has('archived_at')) sqlite.exec('ALTER TABLE case_documents ADD COLUMN archived_at INTEGER');
  if (!documentColumns.has('archived_by_user_id')) sqlite.exec('ALTER TABLE case_documents ADD COLUMN archived_by_user_id TEXT');
  const intakeColumns = new Set((sqlite.prepare('PRAGMA table_info(case_intakes)').all() as Array<{name:string}>).map((c)=>c.name));
  if (!intakeColumns.has('created_case_id')) sqlite.exec('ALTER TABLE case_intakes ADD COLUMN created_case_id TEXT');

  sqlite.pragma('optimize');
}

function createDatabaseState(
  databasePath: string,
  seedDemoData: boolean,
): DatabaseState {
  if (databasePath !== ':memory:') {
    mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const sqlite = new BetterSqlite3(databasePath);
  initializeSchema(sqlite);
  if (seedDemoData) {
    seedSyntheticCaseData(sqlite, databasePath);
    seedSyntheticPolicies(sqlite);
  }

  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
  };
}

export function getDatabase(): DatabaseClient {
  globalDatabase.priorAuthDatabase ??= createDatabaseState(
    resolveDatabasePath(),
    true,
  );
  return globalDatabase.priorAuthDatabase.db;
}

export function createIsolatedDatabase(
  databasePath = ':memory:',
): DatabaseClient {
  return createDatabaseState(databasePath, false).db;
}

export function resetSyntheticDemoData(): void {
  const state = globalDatabase.priorAuthDatabase;
  if (!state) throw new Error('Database is not initialized.');
  const tables = [
    'extracted_facts', 'document_analyses', 'prior_auth_draft_field_sources',
    'prior_auth_draft_fields', 'prior_auth_drafts', 'readiness_requirement_results',
    'readiness_evaluations', 'case_policy_selections', 'case_communications',
    'denial_records', 'case_notes', 'documentation_checklist_items',
    'case_documents', 'case_intake_documents', 'case_intakes',
    'prior_authorization_cases', 'policy_requirements', 'payer_policies', 'payers',
    'audit_events',
  ];
  state.sqlite.transaction(() => {
    for (const table of tables) state.sqlite.prepare(`DELETE FROM ${table}`).run();
  })();
  const dataRoot = path.dirname(resolveDatabasePath());
  rmSync(path.join(dataRoot, 'uploads'), { recursive: true, force: true });
  rmSync(path.join(dataRoot, 'intakes'), { recursive: true, force: true });
  seedSyntheticCaseData(state.sqlite, resolveDatabasePath());
  seedSyntheticPolicies(state.sqlite);
}
