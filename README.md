![ClawMail banner](docs/images/banner.jpeg)

# ClawMail Control Plane

Self-hostable email control plane for OpenClaw fleets with tenant isolation, per-instance blast-radius controls, centralized webhook ingestion, and gateway-mode API access.

## Core Concepts
- `Tenant`: The top-level isolation boundary. Provider credentials, instances, policies, inboxes, logs, and audit events are all scoped to a tenant.
- `User Membership`: A user belongs to one or more tenants with a role (`viewer`, `operator`, `admin`, `owner`) that controls what actions they can perform.
- `Instance`: A logical OpenClaw agent identity inside a tenant. Instances have lifecycle state (`active`, `suspended`, `deprovisioned`) and mode (`gateway` or `direct`).
- `Instance Policy`: Per-instance guardrails for outbound mail (recipient limits, required headers, allow/deny domain lists, rate limits, and daily caps).
- `Gateway Token`: A rotatable, instance-scoped secret used by agents to call `/agent/*` endpoints. Only the token hash is stored server-side.
- `Token Scope`: Permissions attached to a gateway token (for example `send`, `read_inbox`, or `*`) that gate agent capabilities.
- `MailChannels Connection`: Tenant-level provider credentials used to provision and operate sub-accounts for outbound sending.
- `MailChannels Sub-account`: Instance-level sending account created under a tenant’s MailChannels parent account, with its own limits and key lifecycle.
- `AgentMail Connection`: Tenant-level API key used to provision mailbox resources for instances.
- `AgentMail Pod`: A grouping/container in AgentMail where domains and inboxes are created.
- `AgentMail Domain`: A domain attached to a pod for mailbox addressing, along with DNS verification records and status.
- `AgentMail Inbox`: The mailbox mapped to an instance for reading/replying via gateway inbox endpoints.
- `Webhook Event`: Provider delivery/inbox events ingested into the control plane, deduplicated, and attached to tenant/instance context when available.
- `Audit Log`: An immutable operator action trail (for example provisioning, token rotation, policy changes) used for oversight and incident review.

## Why This Exists
OpenClaw agents become high-risk the moment they can interact with email directly. They can send at machine speed, contact the wrong recipients, leak sensitive context, or continue operating after provider credentials are misconfigured or compromised. Inbound email is equally risky: agents can be manipulated by malicious or unexpected replies, and operators can lose visibility into what influenced agent behavior.

This project exists to put a strict control plane between agents and email providers. Instead of handing raw provider keys to agents, operators provision tenant-scoped providers, instance-scoped credentials, and short-lived scoped gateway tokens. Every send and webhook event is captured, policy-checked, and auditable. The result is practical oversight: agents can still use email, but within enforced limits and with clear operational accountability.

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

## Quick Start
### Core concepts
- `Tenant`: security and billing boundary for a team/workspace.
- `Instance`: operational unit inside a tenant (holds provider links, policy state, and agent tokens).
- `Provider connections`: tenant-level credentials for MailChannels and AgentMail.
- `Gateway token`: per-instance token your agents use with `/agent/*` endpoints.

### Run the app
1. Install and start:
```bash
pnpm install
pnpm approve-builds
pnpm run dev
```
2. Open the UI at `http://localhost:5173`.

### Create your first user and tenant
1. On the login screen, use **Register** with:
   - Email
   - Password (12+ characters)
   - Tenant name
2. After registration, open **Tenants** and confirm your tenant exists.

### Connect providers and create an instance
1. In **Tenants**, save MailChannels and/or AgentMail credentials.
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
- Tenant/user auth flows (`auth.*`)
- Tenant management and provider connection storage (`tenants.*`)
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
  - Tenants
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

## Agent Skill
- `SKILLS.md` provides an OpenClaw agent skill for provisioning tenant/instance email access and using the gateway inbox/send APIs.

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
