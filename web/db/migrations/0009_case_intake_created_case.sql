ALTER TABLE case_intakes ADD COLUMN created_case_id TEXT;
ALTER TABLE prior_authorization_cases ADD COLUMN archived_at INTEGER;
ALTER TABLE prior_authorization_cases ADD COLUMN archived_by_user_id TEXT;
