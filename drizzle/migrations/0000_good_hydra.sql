CREATE TABLE `agentmail_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`encrypted_agentmail_api_key` text NOT NULL,
	`default_pod_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agentmail_connections_tenant_id_idx` ON `agentmail_connections` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `agentmail_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`pod_id` text NOT NULL,
	`domain` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`dns_records_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agentmail_inboxes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`instance_id` text NOT NULL,
	`pod_id` text NOT NULL,
	`inbox_id` text NOT NULL,
	`username` text NOT NULL,
	`domain` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instance_id`) REFERENCES `openclaw_instances`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agentmail_pods` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`pod_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`tenant_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`diff_json` text DEFAULT '{}' NOT NULL,
	`timestamp` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `instance_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`instance_id` text NOT NULL,
	`max_recipients_per_message` integer DEFAULT 10 NOT NULL,
	`per_minute_limit` integer DEFAULT 30 NOT NULL,
	`daily_cap` integer DEFAULT 500 NOT NULL,
	`required_headers_json` text DEFAULT '[]' NOT NULL,
	`allow_list_json` text DEFAULT '[]' NOT NULL,
	`deny_list_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`instance_id`) REFERENCES `openclaw_instances`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `instance_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`instance_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`scopes_json` text DEFAULT '[]' NOT NULL,
	`expires_at` integer,
	`rotated_from` text,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`instance_id`) REFERENCES `openclaw_instances`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `job_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`job_type` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`run_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mailchannels_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`mailchannels_account_id` text NOT NULL,
	`encrypted_parent_api_key` text NOT NULL,
	`webhook_endpoint_config` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mailchannels_connections_tenant_id_idx` ON `mailchannels_connections` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `mailchannels_subaccount_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`subaccount_handle` text NOT NULL,
	`provider_key_id` text NOT NULL,
	`redacted_value` text NOT NULL,
	`encrypted_value` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subaccount_handle`) REFERENCES `mailchannels_subaccounts`(`handle`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mailchannels_subaccount_keys_provider_key_idx` ON `mailchannels_subaccount_keys` (`subaccount_handle`,`provider_key_id`);--> statement-breakpoint
CREATE TABLE `mailchannels_subaccounts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`instance_id` text NOT NULL,
	`handle` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`limit` integer DEFAULT -1 NOT NULL,
	`usage_current_period` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instance_id`) REFERENCES `openclaw_instances`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mailchannels_subaccounts_handle_unique` ON `mailchannels_subaccounts` (`handle`);--> statement-breakpoint
CREATE TABLE `openclaw_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`mode` text DEFAULT 'gateway' NOT NULL,
	`last_seen_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rate_limit_buckets` (
	`id` text PRIMARY KEY NOT NULL,
	`instance_id` text NOT NULL,
	`window_key` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`instance_id`) REFERENCES `openclaw_instances`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limit_buckets_instance_window_idx` ON `rate_limit_buckets` (`instance_id`,`window_key`);--> statement-breakpoint
CREATE TABLE `send_log` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`instance_id` text NOT NULL,
	`request_id` text NOT NULL,
	`provider_request_id` text,
	`from_email` text NOT NULL,
	`recipients_json` text NOT NULL,
	`subject_hash` text NOT NULL,
	`provider_status` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instance_id`) REFERENCES `openclaw_instances`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tenant_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_memberships_tenant_user_idx` ON `tenant_memberships` (`tenant_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`instance_id` text,
	`provider` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload_json` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`received_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`processed_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`instance_id`) REFERENCES `openclaw_instances`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_events_dedupe_key_idx` ON `webhook_events` (`dedupe_key`);