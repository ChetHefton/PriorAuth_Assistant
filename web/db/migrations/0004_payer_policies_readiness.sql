CREATE TABLE `payers` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `plan_name` text NOT NULL,
  `is_active` integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX `idx_payers_name_plan` ON `payers` (`name`, `plan_name`);
CREATE INDEX `idx_payers_active` ON `payers` (`is_active`);

CREATE TABLE `payer_policies` (
  `id` text PRIMARY KEY NOT NULL,
  `payer_id` text NOT NULL REFERENCES `payers`(`id`) ON DELETE cascade,
  `policy_name` text NOT NULL,
  `equipment_category` text NOT NULL,
  `hcpcs_codes_json` text NOT NULL DEFAULT '[]',
  `effective_date` text NOT NULL,
  `expiration_date` text,
  `submission_channel` text NOT NULL,
  `follow_up_interval_days` integer,
  `source_type` text NOT NULL,
  `source_reference` text NOT NULL,
  `notes` text NOT NULL DEFAULT '',
  `version` text NOT NULL,
  `is_synthetic` integer NOT NULL DEFAULT 1,
  `is_active` integer NOT NULL DEFAULT 1
);
CREATE INDEX `idx_payer_policies_payer_active` ON `payer_policies` (`payer_id`, `is_active`);
CREATE INDEX `idx_payer_policies_category` ON `payer_policies` (`equipment_category`);

CREATE TABLE `policy_requirements` (
  `id` text PRIMARY KEY NOT NULL,
  `policy_id` text NOT NULL REFERENCES `payer_policies`(`id`) ON DELETE cascade,
  `requirement_key` text NOT NULL,
  `label` text NOT NULL,
  `kind` text NOT NULL,
  `document_type` text,
  `field_key` text,
  `condition_type` text NOT NULL DEFAULT 'ALWAYS',
  `condition_value` text,
  `requirement_level` text NOT NULL DEFAULT 'REQUIRED',
  `explanation` text NOT NULL,
  `blocks_readiness` integer NOT NULL DEFAULT 1,
  `sort_order` integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX `idx_policy_requirements_policy_key` ON `policy_requirements` (`policy_id`, `requirement_key`);
CREATE INDEX `idx_policy_requirements_policy_order` ON `policy_requirements` (`policy_id`, `sort_order`);

CREATE TABLE `case_policy_selections` (
  `id` text PRIMARY KEY NOT NULL,
  `case_id` text NOT NULL REFERENCES `prior_authorization_cases`(`id`) ON DELETE cascade,
  `policy_id` text NOT NULL REFERENCES `payer_policies`(`id`) ON DELETE cascade,
  `selection_type` text NOT NULL,
  `selected_by_user_id` text REFERENCES `users`(`id`) ON DELETE set null,
  `selected_at` integer NOT NULL
);
CREATE UNIQUE INDEX `idx_case_policy_selections_case` ON `case_policy_selections` (`case_id`);
CREATE INDEX `idx_case_policy_selections_policy` ON `case_policy_selections` (`policy_id`);

CREATE TABLE `readiness_evaluations` (
  `id` text PRIMARY KEY NOT NULL,
  `case_id` text NOT NULL REFERENCES `prior_authorization_cases`(`id`) ON DELETE cascade,
  `policy_id` text REFERENCES `payer_policies`(`id`) ON DELETE set null,
  `policy_match_status` text NOT NULL,
  `policy_match_reason` text NOT NULL,
  `selection_type` text,
  `status` text NOT NULL,
  `satisfied_count` integer NOT NULL,
  `applicable_count` integer NOT NULL,
  `next_best_action` text NOT NULL,
  `evaluated_by_user_id` text REFERENCES `users`(`id`) ON DELETE set null,
  `evaluated_at` integer NOT NULL
);
CREATE INDEX `idx_readiness_evaluations_case_time` ON `readiness_evaluations` (`case_id`, `evaluated_at`);

CREATE TABLE `readiness_requirement_results` (
  `id` text PRIMARY KEY NOT NULL,
  `evaluation_id` text NOT NULL REFERENCES `readiness_evaluations`(`id`) ON DELETE cascade,
  `requirement_id` text NOT NULL REFERENCES `policy_requirements`(`id`) ON DELETE cascade,
  `requirement_key` text NOT NULL,
  `label` text NOT NULL,
  `status` text NOT NULL,
  `reason` text NOT NULL,
  `source_document_ids_json` text NOT NULL DEFAULT '[]',
  `source_field_keys_json` text NOT NULL DEFAULT '[]',
  `explanation` text NOT NULL,
  `blocks_readiness` integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX `idx_readiness_results_evaluation_requirement` ON `readiness_requirement_results` (`evaluation_id`, `requirement_id`);
CREATE INDEX `idx_readiness_results_status` ON `readiness_requirement_results` (`evaluation_id`, `status`);
