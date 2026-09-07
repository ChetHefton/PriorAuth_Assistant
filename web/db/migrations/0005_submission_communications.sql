ALTER TABLE prior_authorization_cases ADD COLUMN submitted_at INTEGER;
ALTER TABLE prior_authorization_cases ADD COLUMN submission_channel TEXT;
ALTER TABLE prior_authorization_cases ADD COLUMN external_reference_number TEXT;
ALTER TABLE prior_authorization_cases ADD COLUMN last_follow_up_at INTEGER;
ALTER TABLE prior_authorization_cases ADD COLUMN next_follow_up_at INTEGER;
ALTER TABLE prior_authorization_cases ADD COLUMN submitted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS case_communications (id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES prior_authorization_cases(id) ON DELETE CASCADE, type TEXT NOT NULL, channel TEXT NOT NULL, purpose TEXT NOT NULL, generated_content TEXT NOT NULL, edited_content TEXT, generated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, status TEXT NOT NULL DEFAULT 'DRAFT', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_case_communications_case_time ON case_communications(case_id, created_at);
