CREATE TABLE `document_analyses` (
  `id` text PRIMARY KEY NOT NULL,
  `case_id` text NOT NULL REFERENCES `prior_authorization_cases`(`id`) ON DELETE cascade,
  `document_id` text NOT NULL REFERENCES `case_documents`(`id`) ON DELETE cascade,
  `requested_by_user_id` text REFERENCES `users`(`id`) ON DELETE set null,
  `status` text NOT NULL CHECK (`status` IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  `provider` text NOT NULL,
  `model` text NOT NULL,
  `detected_document_type` text,
  `classification_confidence` text,
  `classification_source_quote` text,
  `classification_needs_review` integer NOT NULL DEFAULT 1,
  `warnings_json` text NOT NULL DEFAULT '[]',
  `failure_code` text,
  `requested_at` integer NOT NULL,
  `completed_at` integer
);
CREATE INDEX `idx_document_analyses_document_requested` ON `document_analyses` (`document_id`, `requested_at`);
CREATE INDEX `idx_document_analyses_case` ON `document_analyses` (`case_id`);

CREATE TABLE `extracted_facts` (
  `id` text PRIMARY KEY NOT NULL,
  `analysis_id` text NOT NULL REFERENCES `document_analyses`(`id`) ON DELETE cascade,
  `field_key` text NOT NULL,
  `original_value` text,
  `confidence` text NOT NULL CHECK (`confidence` IN ('HIGH', 'MEDIUM', 'LOW')),
  `evidence_status` text NOT NULL CHECK (`evidence_status` IN ('SUPPORTED', 'NEEDS_REVIEW', 'CONTRADICTORY', 'NOT_FOUND')),
  `source_quote` text,
  `source_document_id` text NOT NULL REFERENCES `case_documents`(`id`) ON DELETE cascade,
  `uncertainty_note` text,
  `review_decision` text NOT NULL DEFAULT 'PENDING' CHECK (`review_decision` IN ('PENDING', 'ACCEPTED', 'EDITED', 'REJECTED')),
  `reviewed_value` text,
  `reviewed_by_user_id` text REFERENCES `users`(`id`) ON DELETE set null,
  `reviewed_at` integer,
  `created_at` integer NOT NULL
);
CREATE UNIQUE INDEX `idx_extracted_facts_analysis_field` ON `extracted_facts` (`analysis_id`, `field_key`);
CREATE INDEX `idx_extracted_facts_source_document` ON `extracted_facts` (`source_document_id`);
CREATE INDEX `idx_extracted_facts_review` ON `extracted_facts` (`review_decision`);
