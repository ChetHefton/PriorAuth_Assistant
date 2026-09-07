CREATE TABLE prior_authorization_cases (
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
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_prior_authorization_cases_status ON prior_authorization_cases(status);
CREATE INDEX idx_prior_authorization_cases_follow_up_due ON prior_authorization_cases(follow_up_due);

CREATE TABLE documentation_checklist_items (
  id TEXT PRIMARY KEY NOT NULL,
  case_id TEXT NOT NULL REFERENCES prior_authorization_cases(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Received', 'Missing', 'Needs Review', 'Not Required')),
  sort_order INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_documentation_checklist_case_type ON documentation_checklist_items(case_id, document_type);
CREATE INDEX idx_documentation_checklist_case_status ON documentation_checklist_items(case_id, status);

CREATE TABLE case_documents (
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

CREATE UNIQUE INDEX idx_case_documents_stored_filename ON case_documents(stored_filename);
CREATE INDEX idx_case_documents_case_uploaded ON case_documents(case_id, uploaded_at);

CREATE TABLE case_notes (
  id TEXT PRIMARY KEY NOT NULL,
  case_id TEXT NOT NULL REFERENCES prior_authorization_cases(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_case_notes_case_created ON case_notes(case_id, created_at);
