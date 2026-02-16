![ClawMail banner](docs/images/banner.jpeg)

# ClawMail Control Plane

Self-hostable email control plane for OpenClaw fleets with cast isolation,
per-instance blast-radius controls, centralized webhook ingestion, and
gateway-mode API access.

## Why This Exists
OpenClaw agents become high-risk the moment they can interact with email
directly. They can send at machine speed, contact the wrong recipients, leak
sensitive context, or continue operating after provider credentials are
misconfigured or compromised. Inbound email is equally risky: agents can be
manipulated by malicious or unexpected replies, and operators can lose
visibility into what influenced agent behavior.

This project exists to put a strict control plane between agents and email
providers. Instead of handing raw provider keys to agents, operators provision
cast-scoped providers, instance-scoped credentials, and short-lived scoped
gateway tokens. Every send and webhook event is captured, policy-checked, and
auditable. The result is practical oversight: agents can still use email, but
within enforced limits and with clear operational accountability.

## Core Concepts
- `User`: A human user who needs to control or view bot access to email
  resources. **This is you!** Users have one assigned role for each `Cast`.
  Many small organizations will have only one `User` who is the administrator
  of a single `Cast`, while larger organizations will have many users and
  more complex cast management delegation.

- `Cast`: The top-level email isolation boundary, controlled by one or more
  `User`'s. Provider credentials, instances, policies, inboxes, logs, and audit
  events are all scoped to a `Cast`.
 
- `User Membership`: A `User` belongs to one or more casts with a role
  (`viewer`, `operator`, `admin`, `owner`) that controls what actions they can
  perform.

- `Instance`: A logical OpenClaw agent identity inside a cast. Instances have
  lifecycle state (`active`, `suspended`, `deprovisioned`) and mode (`gateway`
  or `direct`).

- `Instance Policy`: Per-instance guardrails for outbound mail (recipient
  limits, required headers, allow/deny domain lists, rate limits, and daily
  caps).

- `Gateway Token`: A rotatable, instance-scoped secret used by agents to call
  `/agent/*` endpoints. Only the token hash is stored server-side.

- `Token Scope`: Permissions attached to a gateway token (for example `send`,
  `read_inbox`, or `*`) that gate agent capabilities.

- `MailChannels Connection`: Cast-level provider credentials used to
  provision and operate sub-accounts for outbound sending.

- `MailChannels Sub-account`: Instance-level sending account created under a
  cast’s MailChannels parent account, with its own limits and key lifecycle.

- `AgentMail Connection`: Cast-level API key used to provision mailbox
  resources for instances.

- `AgentMail Pod`: A grouping/container in AgentMail where domains and inboxes
  are created.

- `AgentMail Domain`: A domain attached to a pod for mailbox addressing, along
  with DNS verification records and status.

- `AgentMail Inbox`: The mailbox mapped to an instance for reading/replying via
  gateway inbox endpoints.

- `Webhook Event`: Provider delivery/inbox events ingested into the control
  plane, deduplicated, and attached to cast/instance context when available.

- `Audit Log`: An immutable operator action trail (for example provisioning,
  token rotation, policy changes) used for oversight and incident review.

## Relationship Diagram
![OpenClaw client, cast, user, and service relationships](docs/images/openclaw-relationships.svg)

This diagram shows the relationships between OpenClaw clients, casts, users,
and services.


## Quick Start
### Core concepts
- `Cast`: security and billing boundary for a team/workspace.
- `Instance`: operational unit inside a cast (holds provider links, policy state, and agent tokens).
- `Provider connections`: cast-level credentials for MailChannels and AgentMail.
- `Gateway token`: per-instance token your agents use with `/agent/*` endpoints.

### Run the app
1. Install and start:
```bash
pnpm install
pnpm approve-builds
pnpm run dev
```
2. Open the UI at `http://localhost:5173`.

### Create your first user and cast
1. On the login screen, use **Register** with:
   - Email
   - Password (12+ characters)
   - Cast name
2. After registration, open **Casts** and confirm your cast exists.

### Connect providers and create an instance
1. In **Casts**, save MailChannels and/or AgentMail credentials.
   - For local smoke tests, default `CONNECTOR_MODE=mock` works without live credentials.
2. Open **Instances**, create a new instance, then click **Rotate Gateway Token**.
3. Copy the one-time token shown in the UI.

### Let an agent use the control plane
Use the gateway token as `Authorization: Bearer <token>` against `/agent/*`:

```bash
curl -X POST http://localhost:3000/agent/send \\
  -H "Authorization: Bearer <gateway-token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "agent@example.com",
    "to": ["ops@example.com"],
    "subject": "hello from agent",
    "textBody": "status: green"
  }'
```

```bash
curl "http://localhost:3000/agent/events?limit=20" \\
  -H "Authorization: Bearer <gateway-token>"
```

## Implemented MVP capabilities
- Cast/user auth flows (`auth.*`)
- Cast management and provider connection storage (`casts.*`)
- Instance lifecycle + policy + token rotation (`instances.*`)
- MailChannels provisioning controls (`mailchannels.*`)
  - sub-account provisioning
  - limit set/delete
  - suspend/activate
  - key rotation
  - usage sync and webhook validation trigger
- AgentMail provisioning controls (`agentmail.*`)
  - ensure pod
  - create domain
  - create inbox
- Gateway mode endpoints (agent token auth)
  - `POST /agent/send`
  - `GET /agent/events`
  - `GET /agent/inbox/threads`
  - `GET /agent/inbox/messages/:id`
  - `POST /agent/inbox/reply`
- Webhook ingestion endpoints
  - `POST /webhooks/mailchannels`
  - `POST /webhooks/agentmail`
- Observability routes
  - `GET /healthz`
  - `GET /metrics`
- In-process DB-backed scheduler for usage/webhook validation jobs
- Operator UI pages
  - Dashboard
  - Casts
  - Instances
  - Domains
  - Webhooks
  - Audit

## Project structure
```text
src/                  # frontend
server/               # Hono + tRPC backend
  routers/            # tRPC routers
  services/           # business logic
drizzle/              # schema + generated migrations
tests/                # unit/integration/component tests
```

## Local development
1. Install dependencies:
```bash
pnpm install
```
2. Ensure native module builds are approved (required for `better-sqlite3`):
```bash
pnpm approve-builds
```
3. Start backend + frontend:
```bash
pnpm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:3000

## Environment variables
Optional defaults are baked in for local development.

- `PORT` (default: `3000`)
- `DATABASE_URL` (default: `./data/clawmail.db`)
- `AUTH_PUBLIC_URL` (optional public app URL used for OAuth callback URLs, e.g. `https://controlplane.example.com`)
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` (optional, required to enable GitHub SSO)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (optional, required to enable Google SSO)
- `APP_ENCRYPTION_KEY` (base64 preferred; dev fallback is used when missing)
- `CONNECTOR_MODE` (`mock` or `live`, default: `mock`)
- `MAILCHANNELS_BASE_URL` (default MailChannels API base)
- `AGENTMAIL_BASE_URL` (default AgentMail API base)
- `MAILCHANNELS_WEBHOOK_VERIFY` (`true`/`false`, default: `false`)
- `WEBHOOK_SHARED_SECRET` (optional webhook shared secret)

## OAuth SSO setup (Google and GitHub)
SSO remains self-hosted: this app only calls Google/GitHub OAuth endpoints directly and does not depend on a third-party auth broker.

1. Configure OAuth apps in each provider.
2. Set `AUTH_PUBLIC_URL` to the externally reachable URL for this app.
3. Set provider credentials via env vars.
4. Register these callback URLs with providers:
   - Google: `https://<your-host>/auth/oauth/google/callback`
   - GitHub: `https://<your-host>/auth/oauth/github/callback`

For local development with Vite (`http://localhost:5173`), use:
- `AUTH_PUBLIC_URL=http://localhost:5173`
- callback URLs on `http://localhost:5173/auth/oauth/...` (Vite proxies `/auth` to the backend)

## Migrations
Generate migration SQL from schema:
```bash
pnpm drizzle-kit generate
```

Migrations are applied automatically at server startup via Drizzle migrator.

## Quality gates
Run all checks:
```bash
pnpm run typecheck
pnpm run lint
pnpm run test
```

# Appendix - Implementation Details

## Stack
- Frontend: Vite + React + TanStack Router
- Backend: Hono + tRPC
- Database: SQLite + Drizzle ORM + generated SQL migrations
- Auth: Lucia session auth + optional Google/GitHub OAuth
- Tests: Vitest + Testing Library

## UX Standards
The operator UI follows Nielsen heuristics and *The Design of Everyday Things* principles:
- Visibility of system status: async actions show loading, success, and failure states.
- Error prevention and recovery: destructive actions are confirmed; errors include retry paths.
- Recognition over recall: forms include inline guidance and disable invalid actions early.
- User control: users can clear inputs, dismiss status states, and retry failed queries.
- Accessibility: focusable controls, semantic labels, and high-contrast status indicators.

## Recent refactors
- 2026-02-16: renamed organization terminology to cast terminology across the project:
  - Replaced legacy organization labels with `Cast`/`cast` in routes, services, database schema naming, tests, docs, and migration metadata.
  - Renamed organization-focused files to cast equivalents (for example `src/routes/casts.tsx`, `server/services/cast-service.ts`, `server/routers/casts.ts`).
  - Updated cast-related UI headings to include crab emojis (for example `Cast 🦀🦀🦀`) per OpenClaw terminology guidance.
- 2026-02-16: consolidated cast creation and selection UX:
  - Added `Create cast...` to the workspace header cast selector and wired it to a create-cast modal flow.
  - Removed duplicated cast listing from the `/casts` panel and replaced it with a selected-cast summary (name + role tag).
  - Kept inline cast creation in `/casts` only for first-time setup when no casts exist.
  - Added UI coverage in `tests/cast-selector.test.tsx` and `tests/casts-route.test.tsx`.
- 2026-02-16: restored live provider credential validation behavior on `/casts`:
  - Credential validation now always uses live MailChannels/AgentMail connectors in non-test environments, even when `CONNECTOR_MODE=mock` is used for provisioning flows.
  - This prevents invalid provider keys from being accepted during cast connection setup.
  - Added unit coverage for the environment-based validation connector selection in `tests/provider-connection-credentials.test.ts`.
- 2026-02-15: moved credential rejection copy into the rejected input field:
  - During failed provider validation, the affected input now displays inline text such as `❌ Credential was rejected by MailChannels.` inside the input itself.
  - Removed separate rejection text rows below inputs to keep feedback scoped to the exact rejected credential field.
- 2026-02-15: clarified inline credential rejection feedback on `/casts`:
  - Added explicit provider-specific rejection copy alongside the `❌` indicator (for example, “Credential was rejected by MailChannels.”).
  - Kept provider error payloads hidden from the UI to avoid exposing raw HTML/error-body output.
  - Continued using the extended failed-validation display window (3x success duration) before returning to editable state.
- 2026-02-15: refined credential validation failure UX on `/casts`:
  - Removed rendering of raw provider error bodies from credential fields (prevents provider HTML/error payload leakage in UI).
  - Kept failure feedback inline via `❌` input overlay only, without persistent `.error-message` blocks.
  - Extended failed-validation inline feedback duration to 3x the success duration so rejection is easier to notice.
- 2026-02-15: added credential validation-first UX for cast provider connections:
  - Added provider credential validation in `server/services/provider-connections-service.ts`, enforced before cast credential persistence.
  - Validation now performs direct provider API calls before persistence:
    - MailChannels parent key via sub-account listing (`GET /sub-account`)
    - AgentMail API key via pod listing (`GET /pods`)
  - Validation uses live provider connectors in non-test runtime so invalid real credentials fail validation even if provisioning mode is otherwise mocked.
  - Reworked `src/routes/casts.tsx` credential flows to show per-input validating shimmer states, inline success (`✅`) and failure (`❌`) overlays, and post-validation transitions to redacted previews or editable re-entry.
  - Added route-level UI coverage for these validation transitions in `tests/casts-route.test.tsx`.
- 2026-02-15: improved cast credential UX for configured provider connections:
  - Added `casts.providerStatus` query to return redacted credential previews (prefix + ellipses) for MailChannels and AgentMail.
  - Updated `src/routes/casts.tsx` to show grey read-only preview fields that switch to replacement mode when clicked.
  - Added timed fade-out + auto-dismiss behavior for provider success pills and extra spacing below the success state.
  - Added coverage in `tests/cast-boundary.test.ts` and `tests/casts-route.test.tsx`.
- 2026-02-15: split provider orchestration into focused services:
  - `server/services/provider-connections-service.ts`
  - `server/services/mailchannels-provisioning-service.ts`
  - `server/services/agentmail-provisioning-service.ts`
  - `server/services/provider-credentials-service.ts`
  - `server/services/provider-service.ts` now acts as a compatibility barrel
  - Added integration coverage in `tests/provider-services-refactor.test.ts`
- 2026-02-15: introduced typed JSON codecs for serialized DB columns:
  - Added `server/lib/json-codec.ts` with `parseStringArray`, `parseRecord`, `safeJson`, and `safeJsonStringify`
  - Updated policy, token, send-log, audit-log, and domain record serialization/deserialization paths
  - Added unit coverage in `tests/json-codec.test.ts`
- 2026-02-15: consolidated cast and instance authorization checks into reusable tRPC procedures:
  - Added `castMemberProcedure`, `castOperatorProcedure`, `castAdminProcedure`, `instanceScopedProcedure`, and `instanceOperatorProcedure` in `server/trpc.ts`
  - Migrated cast-scoped routers to composable wrappers and removed repeated inline auth checks
  - Added integration coverage in `tests/trpc-authorization-procedures.test.ts`
- 2026-02-15: formalized provider connector error mapping:
  - Added `server/connectors/provider-error.ts` and `server/services/provider-error-mapper.ts`
  - Mapped provider HTTP responses to typed `TRPCError` codes at connector call boundaries
  - Added unit coverage in `tests/provider-error-mapper.test.ts`
- 2026-02-15: split the instances route into focused UI components:
  - Added `InstanceCreateForm`, `InstanceList`, `InstanceActions`, and `GatewayTokenPanel` under `src/components/instances/`
  - Simplified `src/routes/instances.tsx` to orchestration-only logic
  - Added component coverage in `tests/instance-actions.test.tsx`
- 2026-02-15: moved scheduler behavior into per-job handlers:
  - Added typed handler modules under `server/jobs/handlers/` and a job handler registry
  - Kept `server/jobs/scheduler.ts` focused on queue orchestration and dispatch
  - Added integration coverage in `tests/job-handlers.test.ts`
- 2026-02-15: added gateway policy enforcement integration coverage:
  - Added `tests/gateway-policy-enforcement.test.ts`
  - Covers required-header enforcement, per-minute limits, daily caps, and allow/deny domain matching
