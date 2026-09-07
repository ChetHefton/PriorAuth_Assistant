CREATE TABLE `prior_auth_drafts` (
  `id` text PRIMARY KEY NOT NULL,
  `case_id` text NOT NULL REFERENCES `prior_authorization_cases`(`id`) ON DELETE cascade,
  `revision` integer NOT NULL DEFAULT 1,
  `notes_json` text NOT NULL,
  `summary_provider` text NOT NULL,
  `summary_model` text NOT NULL,
  `generated_by_user_id` text REFERENCES `users`(`id`) ON DELETE set null,
  `generated_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `idx_prior_auth_drafts_case` ON `prior_auth_drafts` (`case_id`);

CREATE TABLE `prior_auth_draft_fields` (
  `id` text PRIMARY KEY NOT NULL,
  `draft_id` text NOT NULL REFERENCES `prior_auth_drafts`(`id`) ON DELETE cascade,
  `field_key` text NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('MISSING', 'AUTO_POPULATED', 'NEEDS_REVIEW', 'CONFLICT', 'VERIFIED')),
  `ai_proposed_value` text,
  `human_verified_value` text,
  `edited_by_user_id` text REFERENCES `users`(`id`) ON DELETE set null,
  `edited_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `idx_prior_auth_draft_fields_draft_key` ON `prior_auth_draft_fields` (`draft_id`, `field_key`);
CREATE INDEX `idx_prior_auth_draft_fields_status` ON `prior_auth_draft_fields` (`draft_id`, `status`);

CREATE TABLE `prior_auth_draft_field_sources` (
  `id` text PRIMARY KEY NOT NULL,
  `draft_field_id` text NOT NULL REFERENCES `prior_auth_draft_fields`(`id`) ON DELETE cascade,
  `extracted_fact_id` text NOT NULL REFERENCES `extracted_facts`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX `idx_prior_auth_draft_field_sources_unique` ON `prior_auth_draft_field_sources` (`draft_field_id`, `extracted_fact_id`);
CREATE INDEX `idx_prior_auth_draft_field_sources_fact` ON `prior_auth_draft_field_sources` (`extracted_fact_id`);
