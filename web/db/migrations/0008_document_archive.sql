ALTER TABLE case_documents ADD COLUMN archived_at INTEGER;
ALTER TABLE case_documents ADD COLUMN archived_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
