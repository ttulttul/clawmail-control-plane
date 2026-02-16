import { relations, sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const oauthAccounts = sqliteTable(
  "oauth_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["github", "google"] }).notNull(),
    providerUserId: text("provider_user_id").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    providerUserUnique: uniqueIndex("oauth_accounts_provider_user_idx").on(
      table.provider,
      table.providerUserId,
    ),
    providerUserPerUserUnique: uniqueIndex("oauth_accounts_provider_owner_idx").on(
      table.provider,
      table.userId,
    ),
  }),
);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
});

export const risks = sqliteTable("risks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const riskMemberships = sqliteTable(
  "risk_memberships",
  {
    id: text("id").primaryKey(),
    riskId: text("risk_id")
      .notNull()
      .references(() => risks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: ["owner", "admin", "operator", "viewer"],
    })
      .notNull()
      .default("viewer"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    riskUserUnique: uniqueIndex("risk_memberships_risk_user_idx").on(
      table.riskId,
      table.userId,
    ),
  }),
);

export const mailchannelsConnections = sqliteTable(
  "mailchannels_connections",
  {
    id: text("id").primaryKey(),
    riskId: text("risk_id")
      .notNull()
      .references(() => risks.id, { onDelete: "cascade" }),
    mailchannelsAccountId: text("mailchannels_account_id").notNull(),
    encryptedParentApiKey: text("encrypted_parent_api_key").notNull(),
    webhookEndpointConfig: text("webhook_endpoint_config"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    riskUnique: uniqueIndex("mailchannels_connections_risk_id_idx").on(
      table.riskId,
    ),
  }),
);

export const agentmailConnections = sqliteTable(
  "agentmail_connections",
  {
    id: text("id").primaryKey(),
    riskId: text("risk_id")
      .notNull()
      .references(() => risks.id, { onDelete: "cascade" }),
    encryptedAgentmailApiKey: text("encrypted_agentmail_api_key").notNull(),
    defaultPodId: text("default_pod_id"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    riskUnique: uniqueIndex("agentmail_connections_risk_id_idx").on(
      table.riskId,
    ),
  }),
);

export const openclawInstances = sqliteTable("openclaw_instances", {
  id: text("id").primaryKey(),
  riskId: text("risk_id")
    .notNull()
    .references(() => risks.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status", {
    enum: ["active", "suspended", "deprovisioned"],
  })
    .notNull()
    .default("active"),
  mode: text("mode", { enum: ["gateway", "direct"] })
    .notNull()
    .default("gateway"),
  lastSeenAt: integer("last_seen_at"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const instancePolicies = sqliteTable("instance_policies", {
  id: text("id").primaryKey(),
  instanceId: text("instance_id")
    .notNull()
    .references(() => openclawInstances.id, { onDelete: "cascade" }),
  maxRecipientsPerMessage: integer("max_recipients_per_message").notNull().default(10),
  perMinuteLimit: integer("per_minute_limit").notNull().default(30),
  dailyCap: integer("daily_cap").notNull().default(500),
  requiredHeadersJson: text("required_headers_json").notNull().default("[]"),
  allowListJson: text("allow_list_json").notNull().default("[]"),
  denyListJson: text("deny_list_json").notNull().default("[]"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const mailchannelsSubaccounts = sqliteTable("mailchannels_subaccounts", {
  id: text("id").primaryKey(),
  riskId: text("risk_id")
    .notNull()
    .references(() => risks.id, { onDelete: "cascade" }),
  instanceId: text("instance_id")
    .notNull()
    .references(() => openclawInstances.id, { onDelete: "cascade" }),
  handle: text("handle").notNull().unique(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  limit: integer("limit").notNull().default(-1),
  usageCurrentPeriod: integer("usage_current_period").notNull().default(0),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const mailchannelsSubaccountKeys = sqliteTable(
  "mailchannels_subaccount_keys",
  {
    id: text("id").primaryKey(),
    riskId: text("risk_id")
      .notNull()
      .references(() => risks.id, { onDelete: "cascade" }),
    subaccountHandle: text("subaccount_handle")
      .notNull()
      .references(() => mailchannelsSubaccounts.handle, { onDelete: "cascade" }),
    providerKeyId: text("provider_key_id").notNull(),
    redactedValue: text("redacted_value").notNull(),
    encryptedValue: text("encrypted_value"),
    status: text("status", { enum: ["active", "retiring", "revoked"] })
      .notNull()
      .default("active"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    uniqueProviderKey: uniqueIndex("mailchannels_subaccount_keys_provider_key_idx").on(
      table.subaccountHandle,
      table.providerKeyId,
    ),
  }),
);

export const agentmailPods = sqliteTable("agentmail_pods", {
  id: text("id").primaryKey(),
  riskId: text("risk_id")
    .notNull()
    .references(() => risks.id, { onDelete: "cascade" }),
  podId: text("pod_id").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const agentmailDomains = sqliteTable("agentmail_domains", {
  id: text("id").primaryKey(),
  riskId: text("risk_id")
    .notNull()
    .references(() => risks.id, { onDelete: "cascade" }),
  podId: text("pod_id").notNull(),
  domain: text("domain").notNull(),
  status: text("status").notNull().default("pending"),
  dnsRecordsJson: text("dns_records_json").notNull().default("[]"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const agentmailInboxes = sqliteTable("agentmail_inboxes", {
  id: text("id").primaryKey(),
  riskId: text("risk_id")
    .notNull()
    .references(() => risks.id, { onDelete: "cascade" }),
  instanceId: text("instance_id")
    .notNull()
    .references(() => openclawInstances.id, { onDelete: "cascade" }),
  podId: text("pod_id").notNull(),
  inboxId: text("inbox_id").notNull(),
  username: text("username").notNull(),
  domain: text("domain").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const instanceTokens = sqliteTable("instance_tokens", {
  id: text("id").primaryKey(),
  instanceId: text("instance_id")
    .notNull()
    .references(() => openclawInstances.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  scopesJson: text("scopes_json").notNull().default("[]"),
  expiresAt: integer("expires_at"),
  rotatedFrom: text("rotated_from"),
  revokedAt: integer("revoked_at"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const sendLog = sqliteTable("send_log", {
  id: text("id").primaryKey(),
  riskId: text("risk_id")
    .notNull()
    .references(() => risks.id, { onDelete: "cascade" }),
  instanceId: text("instance_id")
    .notNull()
    .references(() => openclawInstances.id, { onDelete: "cascade" }),
  requestId: text("request_id").notNull(),
  providerRequestId: text("provider_request_id"),
  fromEmail: text("from_email").notNull(),
  recipientsJson: text("recipients_json").notNull(),
  subjectHash: text("subject_hash").notNull(),
  providerStatus: text("provider_status").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const webhookEvents = sqliteTable(
  "webhook_events",
  {
    id: text("id").primaryKey(),
    riskId: text("risk_id").references(() => risks.id, {
      onDelete: "set null",
    }),
    instanceId: text("instance_id").references(() => openclawInstances.id, {
      onDelete: "set null",
    }),
    provider: text("provider", { enum: ["mailchannels", "agentmail"] }).notNull(),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(),
    payloadJson: text("payload_json").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    receivedAt: integer("received_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    processedAt: integer("processed_at"),
  },
  (table) => ({
    dedupeUnique: uniqueIndex("webhook_events_dedupe_key_idx").on(table.dedupeKey),
  }),
);

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  riskId: text("risk_id")
    .notNull()
    .references(() => risks.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  diffJson: text("diff_json").notNull().default("{}"),
  timestamp: integer("timestamp")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const jobQueue = sqliteTable("job_queue", {
  id: text("id").primaryKey(),
  riskId: text("risk_id").references(() => risks.id, {
    onDelete: "cascade",
  }),
  jobType: text("job_type").notNull(),
  payloadJson: text("payload_json").notNull(),
  status: text("status", { enum: ["queued", "running", "failed", "completed"] })
    .notNull()
    .default("queued"),
  runAt: integer("run_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  lastError: text("last_error"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const rateLimitBuckets = sqliteTable(
  "rate_limit_buckets",
  {
    id: text("id").primaryKey(),
    instanceId: text("instance_id")
      .notNull()
      .references(() => openclawInstances.id, { onDelete: "cascade" }),
    windowKey: text("window_key").notNull(),
    count: integer("count").notNull().default(0),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    uniqueBucket: uniqueIndex("rate_limit_buckets_instance_window_idx").on(
      table.instanceId,
      table.windowKey,
    ),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(riskMemberships),
}));

export const risksRelations = relations(risks, ({ many }) => ({
  memberships: many(riskMemberships),
  instances: many(openclawInstances),
}));

export const riskMembershipsRelations = relations(
  riskMemberships,
  ({ one }) => ({
    risk: one(risks, {
      fields: [riskMemberships.riskId],
      references: [risks.id],
    }),
    user: one(users, {
      fields: [riskMemberships.userId],
      references: [users.id],
    }),
  }),
);

export const instancesRelations = relations(openclawInstances, ({ one, many }) => ({
  risk: one(risks, {
    fields: [openclawInstances.riskId],
    references: [risks.id],
  }),
  policies: many(instancePolicies),
  tokens: many(instanceTokens),
}));

export const instanceTokensRelations = relations(instanceTokens, ({ one }) => ({
  instance: one(openclawInstances, {
    fields: [instanceTokens.instanceId],
    references: [openclawInstances.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Risk = typeof risks.$inferSelect;
export type RiskMembership = typeof riskMemberships.$inferSelect;
export type OpenclawInstance = typeof openclawInstances.$inferSelect;
export type InstancePolicy = typeof instancePolicies.$inferSelect;
export type InstanceToken = typeof instanceTokens.$inferSelect;
