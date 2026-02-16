# ClawMail Control Plane

*A self-hostable, open-source “email control plane” for fleets of OpenClaw agents—built to isolate credentials, enforce quotas, safely ingest webhooks, and contain blast radius.*

## Why this project exists

If you hand a fleet of OpenClaw instances the **same** MailChannels API key (or the same inbox-provider API key), you’re implicitly accepting:

* **Shared blast radius**: one compromised agent can burn your whole sending reputation and quota.
* **No per-agent guardrails**: you can’t easily cap, throttle, or instantly shut off a single agent.
* **Credential sprawl**: secrets end up in lots of places; rotation becomes operationally expensive.

MailChannels Email API **sub-accounts** exist specifically to solve the “one parent account, many isolated senders” problem (with features like **per-sub-account limits**, key management, and **suspend/activate**). Sub-accounts have a hard requirement/constraint: they’re only available on higher-tier plans (MailChannels documents them as available on “100K and higher plans”). ([MailChannels API Documentation][1])

AgentMail exists specifically to give agents inboxes via API, including **pods** (multi-cast isolation) and programmatic inbox creation. ([AgentMail][2])

This design ties those together in a single self-hostable control plane.

---

## Goals

### Primary goals

1. **Per-agent isolation for outbound mail**

   * One MailChannels **sub-account per OpenClaw instance** (or per “agent group”).
   * Separate API keys per sub-account, allowing targeted revocation and rotation.
   * Per-sub-account **send limits** and instant **suspend/activate** kill switch. ([MailChannels API Documentation][3])

2. **Centralized, secure inbound processing**

   * Receive MailChannels **delivery webhooks** once, verify signatures, store events, and route to the correct agent. ([MailChannels API Documentation][4])

3. **Automated mailbox provisioning**

   * Create/maintain AgentMail pods/domains/inboxes for each agent.
   * Route inbound email events to agents without giving them global AgentMail org keys.

4. **Self-hostable, small footprint**

   * Single container
   * SQLite/Drizzle
   * Hono backend + tRPC
   * Vite/React UI
   * Lucia auth

### Non-goals (explicit)

* Replace MailChannels or AgentMail infrastructure.
* Become a full MTA or deliverability suite.
* Provide a full OpenClaw runtime/orchestrator (this is a “control plane”, not the agent host).

---

## Key design decision: “Direct keys” vs “Gateway mode”

To “maximize ability to control how agents send email,” you need to decide where enforcement happens.

### Option A — Direct keys (simplest)

Each OpenClaw instance is given:

* A MailChannels **sub-account API key**
* The sub-account handle as account ID (as expected by the OpenClaw MailChannels skill) ([GitHub][5])

**Pros**

* Works with existing OpenClaw MailChannels skill immediately. ([GitHub][5])
* Fewer moving parts (control plane is not in the send path).

**Cons**

* Control plane cannot enforce fine-grained policies (recipient allowlists, per-minute throttles, “must include headers”, etc.) because the agent talks directly to MailChannels.

### Option B — Gateway mode (recommended default for security)

OpenClaw instances **do not** receive MailChannels or AgentMail provider keys.
Instead, each instance gets a **scoped token** to call ClawMail CP endpoints like:

* `POST /agent/send` (ClawMail CP -> MailChannels)
* `GET /agent/inbox/*` (ClawMail CP -> AgentMail)

**Pros**

* Central enforcement: per-minute rate limits, policy checks, mandatory headers, logging.
* Rotation is near zero-touch (keys stay inside CP).
* Strong containment: agent token can be scoped to a single instance/inbox/sub-account.

**Cons**

* Control plane is in the data path for sending/reading email.

**Design choice**

* Build **both**, but make **Gateway mode** the “secure-by-default” path.
* Still support “Direct keys” for users who want minimal infrastructure.

---

## Conceptual model

### Entities

* **Cast (Organization)**: a customer (hosting-provider scenario) or internal team (enterprise scenario).
* **OpenClaw Instance**: one running agent environment.
* **Outbound Identity (MailChannels)**: one sub-account per instance (or per group).
* **Inbound Identity (AgentMail)**: one inbox per instance (under a cast pod).

### Default mapping

* **Cast** → 1 MailChannels parent connection + 1 AgentMail org connection
* **OpenClaw instance** → 1 MailChannels sub-account + 1 AgentMail inbox

---

## External dependencies and assumptions

### MailChannels Email API prerequisites

MailChannels requires:

1. at least one **SMTP password** on the account (even though it’s not used for Email API requests; MailChannels notes this requirement will be removed),
2. an API key with `api` scope, and
3. a Domain Lockdown TXT record per sending domain. ([MailChannels API Documentation][6])

Domain Lockdown record example (from MailChannels docs):

```
_mailchannels.example.com TXT v=mc1 auth=examplecorp
```

([MailChannels API Documentation][6])

### Sub-accounts (critical constraint)

* Sub-account handles must be **lowercase alphanumeric**, unique, and sub-accounts are only available on specific plans. ([MailChannels API Documentation][1])

### Key visibility constraints (critical)

When you retrieve sub-account API keys, MailChannels **does not return the full key value**, only ID + redacted value. This means the control plane must treat key creation as a one-time capture event and store it securely (or rotate when needed). ([MailChannels API Documentation][7])

---

## System architecture

### Single-container layout (target stack)

* **Frontend**: Vite + React + TanStack Router
* **Backend**: Hono (HTTP server) + tRPC (typed API)
* **DB**: SQLite (file) + Drizzle ORM
* **Auth**: Lucia sessions
* **Job runner**: in-process scheduler backed by DB tables (so tasks survive restarts)

### Key modules

1. **Cast & Auth module**

   * Lucia session auth
   * RBAC: owner/admin/operator/viewer
   * Optional “provider admin” role for hosting providers

2. **MailChannels Connector**

   * Create/list/delete sub-accounts
   * Create/list/delete API keys and SMTP passwords
   * Set/delete per-sub-account limits
   * Suspend/activate sub-accounts ([MailChannels API Documentation][8])
   * Enroll/validate webhooks and ingest events ([MailChannels API Documentation][4])

3. **AgentMail Connector**

   * Create/list pods ([AgentMail][2])
   * Create/list domains (custom domain optional; otherwise defaults to `@agentmail.to`) ([AgentMail][9])
   * Create inbox per agent
   * Subscribe to inbound events (webhooks/websockets) and route internally

4. **Policy engine**

   * Per-instance and per-cast constraints:

     * time-based rate limits (token bucket)
     * daily caps (local)
     * recipient allow/deny lists
     * allowed “From” patterns/domains
     * “requires headers” rules (especially if you want to enforce OpenClaw skill expectations like `X-AI-Bot` and `List-Unsubscribe`) ([GitHub][5])

5. **Agent-facing Gateway API (recommended path)**

   * `POST /agent/send` -> MailChannels `/send` or `/send-async`
   * `GET /agent/inbox/threads`, `/messages`, etc -> AgentMail APIs
   * All authenticated via per-instance token, not provider keys

6. **Webhook ingestion**

   * MailChannels: verify signature (Ed25519) and content digest per OpenClaw skill guidance; cache public keys by key id ([GitHub][5])
   * Store events, dedupe, then route to the right instance by `customer_handle`

---

## Provisioning flows

### 1) Cast onboarding wizard

**Goal**: connect provider accounts once, verify prerequisites, and set defaults.

Steps:

1. **Connect MailChannels**

   * Admin pastes parent API key (must have `api` scope) ([MailChannels API Documentation][6])
   * Admin enters MailChannels Account ID (used for Domain Lockdown record and often needed for troubleshooting). ([MailChannels API Documentation][6])
   * UI generates Domain Lockdown TXT records for configured sending domains. ([MailChannels API Documentation][6])
   * Optional: remind/verify “SMTP password exists” prerequisite. ([MailChannels API Documentation][6])

2. **Connect AgentMail**

   * Admin pastes AgentMail API key (stored encrypted in DB)
   * Create (or select) a **Pod** for this cast (recommended for isolation). ([AgentMail][2])

3. **Webhook setup**

   * Configure MailChannels delivery webhook endpoint once per MailChannels customer.
   * Handle “already enrolled” gracefully (MailChannels returns a conflict if one already exists). ([MailChannels API Documentation][4])
   * Run `POST /webhook/validate` to ensure reachability and correctness. ([MailChannels API Documentation][10])

### 2) Provision a new OpenClaw instance

**Goal**: create isolated outbound + inbound resources and produce the instance’s config.

Steps (happy path):

1. Create MailChannels **sub-account** for this instance

   * Generate handle (lowercase alphanumeric) ([MailChannels API Documentation][1])
   * Store handle ↔ instance mapping

2. Apply controls

   * Set per-sub-account limit (default “0 until verified”, or a small sandbox limit)
   * Optionally suspend until verified, then activate. ([MailChannels API Documentation][8])

3. Create a sub-account API key

   * Capture the key at creation time (since you can’t retrieve full value later). ([MailChannels API Documentation][7])
   * Store it encrypted (or store only if using Direct mode; in Gateway mode it can stay server-side only).

4. Create AgentMail inbox

   * In the cast’s pod, create an inbox (optionally using a custom domain if configured).
   * If no domain configured, AgentMail uses `@agentmail.to` by default. ([AgentMail][9])

5. Output instance configuration

   * **Gateway mode (recommended):**

     * `CLAWMAIL_CP_URL`
     * `CLAWMAIL_INSTANCE_TOKEN`
     * (Optionally) “capabilities” flags: `send`, `read_inbox`, `webhook_pull`
   * **Direct MailChannels mode (optional):**

     * `MAILCHANNELS_API_KEY`
     * `MAILCHANNELS_ACCOUNT_ID` (sub-account handle)
     * `MAILCHANNELS_BASE_URL=https://api.mailchannels.net/tx/v1` (if configurable)
     * Matches the OpenClaw MailChannels skill expectations. ([GitHub][5])

---

## Operational controls and “damage containment”

### Controls that MailChannels gives you (use them aggressively)

1. **Suspend sub-account**

   * Instant “kill switch” to prevent sending. ([MailChannels API Documentation][8])

2. **Per-sub-account limit**

   * Hard cap per instance (interpretation: MailChannels represents a numeric limit; `-1` inherits parent capacity). ([MailChannels API Documentation][11])
   * Deleting the limit reverts to parent limit. ([MailChannels API Documentation][12])

3. **Usage stats**

   * Pull sub-account usage “for the current billing period” to detect runaway behavior early. ([MailChannels API Documentation][13])

4. **API key lifecycle**

   * List keys returns redacted values only (so you must store secrets at creation time and design rotation carefully). ([MailChannels API Documentation][7])
   * Delete keys by ID. ([MailChannels API Documentation][14])

### Controls ClawMail CP adds (especially in Gateway mode)

1. **Time-based rate limiting**

   * Token bucket: per-instance, per-cast, and global caps.
   * This is the “rate limit” most people actually want (per-minute/hour), and it complements MailChannels’ limit.

2. **Policy enforcement**

   * Recipient allowlist (e.g., only send to your own staff domain in test environments)
   * Denylist risky TLDs or disposable email domains
   * Max recipients per message
   * Required headers (`X-AI-Bot`, `List-Unsubscribe`) aligned with the OpenClaw skill’s guidance ([GitHub][5])

3. **Human-in-the-loop gates**

   * “Draft-only mode” until an operator approves
   * Approval required above a threshold (e.g., >N recipients, unknown domain, etc.)

4. **Auto-remediation**

   * If bounce/drop rate spikes or volume spikes:

     * automatically set a stricter limit
     * or suspend the sub-account
   * This is especially valuable for hosting providers.

---

## Webhook strategy

### MailChannels webhook enrollment

* Use the documented `POST /webhook` enrollment flow. ([MailChannels API Documentation][4])
* If an endpoint already exists, treat that as idempotent success (or give the admin a guided “replace webhook” workflow). ([MailChannels API Documentation][4])
* Validate with `POST /webhook/validate`. ([MailChannels API Documentation][10])

### MailChannels webhook verification and routing

The OpenClaw MailChannels skill documents a strong approach:

* Verify request signatures using the provided headers (`Content-Digest`, `Signature-Input`, `Signature`)
* Fetch the signing public key using `/webhook/public-key?id=...`
* Verify Ed25519 signatures (avoid hand-rolling) ([GitHub][5])

ClawMail CP should:

* Cache webhook public keys by key id (short TTL, e.g. 10 minutes; refresh on verification failure).
* Dedupe events by (provider + `request_id` + event type + timestamp bucket).
* Route to instance by `customer_handle` (which corresponds to the sub-account handle in your mapping). ([GitHub][5])

### AgentMail inbound events

AgentMail supports real-time events (webhooks/websockets) and pods for isolation. ([AgentMail][15])
ClawMail CP should:

* Consume events centrally
* Persist message metadata and a pointer to the inbox/thread/message
* Deliver to OpenClaw either:

  * **push** (forward webhook to agent host), or
  * **pull** (agent polls `GET /agent/events`)

---

## Data model (SQLite/Drizzle)

Below is a high-signal schema outline (names are illustrative).

### Auth & tenancy

* `users` (id, email, password_hash/SSO, created_at)
* `sessions` (lucia)
* `casts` (id, name, created_at)
* `cast_memberships` (cast_id, user_id, role)

### Connections (encrypted secrets)

* `mailchannels_connections`

  * cast_id
  * mailchannels_account_id (for Domain Lockdown + UI display) ([MailChannels API Documentation][6])
  * encrypted_parent_api_key
  * webhook_endpoint_config (json)
* `agentmail_connections`

  * cast_id
  * encrypted_agentmail_api_key
  * default_pod_id

### Resources

* `openclaw_instances`

  * cast_id
  * name
  * status (active/suspended/deprovisioned)
  * last_seen_at
* `mailchannels_subaccounts`

  * cast_id
  * instance_id
  * handle
  * enabled (mirror)
  * limit (cached)
* `mailchannels_subaccount_keys`

  * cast_id
  * subaccount_handle
  * provider_key_id
  * redacted_value (for display)
  * encrypted_value (only if you must show once / or for Direct mode)
  * status (active/retiring/revoked)
* `agentmail_pods`

  * cast_id
  * pod_id
* `agentmail_domains`

  * cast_id
  * pod_id
  * domain
  * status
  * dns_records_json
* `agentmail_inboxes`

  * cast_id
  * instance_id
  * pod_id
  * inbox_id (or address)
  * username
  * domain

### Control plane tokens

* `instance_tokens`

  * instance_id
  * token_hash
  * scopes (json)
  * expires_at (nullable)
  * rotated_from (nullable)

### Observability & audit

* `send_log`

  * instance_id
  * request_id
  * from
  * to
  * subject_hash
  * created_at
  * provider_status
* `webhook_events`

  * provider (mailchannels/agentmail)
  * provider_event_id
  * payload_json
  * received_at
  * processed_at
* `audit_log`

  * actor_user_id
  * cast_id
  * action
  * target_type/target_id
  * diff_json
  * timestamp

---

## API design (tRPC + Hono)

### Public HTTP routes (Hono)

* `POST /webhooks/mailchannels`

  * verifies signature, enqueues events
* `POST /webhooks/agentmail`

  * validates secret (or signature), enqueues events
* `GET /healthz`

  * readiness/liveness
* `GET /metrics` (optional)

  * basic counters

### tRPC routers (typed app API)

* `auth.*` (login/logout/me)
* `casts.*` (create cast, invite member, roles)
* `instances.*` (create instance, rotate token, set policies)
* `mailchannels.*`

  * `provisionSubaccount(instanceId, limit)`
  * `suspendSubaccount(instanceId)`
  * `activateSubaccount(instanceId)`
  * `rotateSubaccountKey(instanceId)`
  * `setLimit(instanceId, limit)` / `deleteLimit(instanceId)`
  * `syncUsage(instanceId)` (poll usage stats) ([MailChannels API Documentation][13])
* `agentmail.*`

  * `ensurePod(castId)`
  * `createDomain(podId, domain)`
  * `createInbox(instanceId, username, domain?)`
* `logs.*` (list sends, events, audit)

### Agent-facing “Gateway mode” endpoints (Hono or tRPC w/ token auth)

* `POST /agent/send`
* `GET /agent/events`
* `GET /agent/inbox/threads`
* `GET /agent/inbox/messages/:id`
* `POST /agent/inbox/reply`

(Implementation detail: these should not use Lucia sessions; they should use instance tokens with scoped auth middleware.)

---

## UI/UX: what operators will actually do

### Navigation

1. **Dashboard**

   * Total sends (last 24h / 7d)
   * Instances with “near limit”
   * Suspended instances
   * Webhook health status

2. **Casts**

   * Create cast
   * View connections
   * Membership & roles

3. **Instances**

   * Provision new instance (wizard)
   * Copy “Gateway token config” or “Direct key config”
   * Suspend / Activate
   * Limits and rate policies
   * Recent sends and delivery events

4. **Domains**

   * MailChannels Domain Lockdown record generator per domain ([MailChannels API Documentation][6])
   * AgentMail domain status + DNS records returned from API ([AgentMail][16])

5. **Webhooks**

   * MailChannels webhook configured endpoint(s)
   * “Validate webhook” button (calls MailChannels validate endpoint) ([MailChannels API Documentation][10])

6. **Audit**

   * Every credential rotation
   * Every suspension/activation
   * Every policy change

---

## Secret storage and key management

### Storage

* Store provider keys encrypted using an app-level master key (env var).
* Use authenticated encryption (AES-256-GCM) with:

  * random nonce per secret
  * key versioning for rotation
* Never log secrets; redact at UI boundary.

### Rotation strategy (MailChannels sub-account keys)

Because full API key values are not returned when listing keys ([MailChannels API Documentation][7]):

* Default to **dual-key rotation**:

  1. Create new key
  2. Update agent config (or gateway uses new key internally immediately)
  3. Delete old key by id ([MailChannels API Documentation][14])

* If MailChannels enforces a strict max key count per sub-account (docs mention 422 “limit reached” on create), the rotator should:

  * delete oldest “retiring” key first
  * then create the new key

---

## Background jobs (single-container friendly)

Use a DB-backed job table (SQLite) and an in-process scheduler:

* **Usage polling**

  * Every N minutes, fetch usage for sub-accounts, update cache, trigger alerts. ([MailChannels API Documentation][13])

* **Webhook validation**

  * Nightly (or on demand) run MailChannels webhook validate and surface failures. ([MailChannels API Documentation][10])

* **Auto-remediation**

  * If thresholds exceeded:

    * set stricter limit
    * suspend sub-account ([MailChannels API Documentation][8])

---

## Extensibility points (important for open source longevity)

1. **Provider connectors**

   * `MailChannelsConnector` interface
   * `AgentMailConnector` interface
   * Add future mailbox providers or email APIs without refactoring core

2. **Policy engine hooks**

   * `beforeSend(message, context)` → allow/deny/mutate
   * `afterEvent(event, context)` → route/alert/remediate

3. **Provisioning API**

   * Hosting providers can integrate their own “customer creation” flows by calling ClawMail CP programmatically.

---

## Risk analysis and mitigations

### Risk: control plane becomes a single point of failure (Gateway mode)

Mitigations:

* Keep Direct mode available
* Provide simple HA guidance (run 2 replicas with shared SQLite on a volume is tricky; better is external DB—but that breaks “small footprint”)
* Practical compromise: Gateway mode is recommended for security; Direct mode is fallback for availability-sensitive deployments.

### Risk: casts can see each other’s data (multi-cast bug)

Mitigations:

* Cast scoping middleware at DB query layer
* Strong type-safe procedures (tRPC + Zod)
* Integration tests for “cast boundary” invariants

### Risk: webhook spoofing

Mitigations:

* Signature verification and public-key caching per OpenClaw skill guidance ([GitHub][5])
* Strict JSON schema validation
* IP allowlists optionally (but never rely only on allowlists)

---

## Summary of what engineers should build first (MVP slice)

**MVP should deliver immediate value in ~3 capabilities:**

1. Provision MailChannels sub-account + key + limit + suspend/activate
2. Provision AgentMail pod + inbox
3. Provide a secure per-instance token and a “Gateway send” endpoint with rate limiting + logging

That already unlocks:

* per-agent blast radius containment
* clean key rotation
* kill switch
* self-hostable “email access for agents” for hosting providers and internal teams

---

## References

[1]: https://docs.mailchannels.net/email-api/api-reference/create-sub-account/ "https://docs.mailchannels.net/email-api/api-reference/create-sub-account/"
[2]: https://docs.agentmail.to/api-reference/pods/create "https://docs.agentmail.to/api-reference/pods/create"
[3]: https://docs.mailchannels.net/email-api/api-reference/set-sub-account-limit "https://docs.mailchannels.net/email-api/api-reference/set-sub-account-limit"
[4]: https://docs.mailchannels.net/email-api/api-reference/enroll-for-webhook-notifications/ "https://docs.mailchannels.net/email-api/api-reference/enroll-for-webhook-notifications/"
[5]: https://raw.githubusercontent.com/mailchannels/mailchannels-openclaw/main/mailchannels-email-api/SKILL.md "https://raw.githubusercontent.com/mailchannels/mailchannels-openclaw/main/mailchannels-email-api/SKILL.md"
[6]: https://docs.mailchannels.net/email-api/getting-started/authentication/ "Authentication | MailChannels"
[7]: https://docs.mailchannels.net/email-api/api-reference/retrieve-sub-account-api-keys/ "https://docs.mailchannels.net/email-api/api-reference/retrieve-sub-account-api-keys/"
[8]: https://docs.mailchannels.net/email-api/api-reference/suspend-sub-account/ "https://docs.mailchannels.net/email-api/api-reference/suspend-sub-account/"
[9]: https://docs.agentmail.to/quickstart "https://docs.agentmail.to/quickstart"
[10]: https://docs.mailchannels.net/email-api/api-reference/validate-enrolled-webhook/ "https://docs.mailchannels.net/email-api/api-reference/validate-enrolled-webhook/"
[11]: https://docs.mailchannels.net/email-api/api-reference/retrieve-sub-account-limit "https://docs.mailchannels.net/email-api/api-reference/retrieve-sub-account-limit"
[12]: https://docs.mailchannels.net/email-api/api-reference/delete-sub-account-limit/ "https://docs.mailchannels.net/email-api/api-reference/delete-sub-account-limit/"
[13]: https://docs.mailchannels.net/email-api/api-reference/retrieve-sub-account-usage-stats/ "https://docs.mailchannels.net/email-api/api-reference/retrieve-sub-account-usage-stats/"
[14]: https://docs.mailchannels.net/email-api/api-reference/delete-sub-account-api-key/ "https://docs.mailchannels.net/email-api/api-reference/delete-sub-account-api-key/"
[15]: https://docs.agentmail.to/integrations/moltbot "https://docs.agentmail.to/integrations/moltbot"
[16]: https://docs.agentmail.to/api-reference/pods/domains/create "https://docs.agentmail.to/api-reference/pods/domains/create"
