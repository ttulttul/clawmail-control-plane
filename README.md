![ClawMail banner](docs/images/banner.jpeg)

# ClawMail Control Plane

Self-hostable email control plane for OpenClaw fleets with tenant isolation, per-instance blast-radius controls, centralized webhook ingestion, and gateway-mode API access.

## Stack
- Frontend: Vite + React + TanStack Router
- Backend: Hono + tRPC
- Database: SQLite + Drizzle ORM + generated SQL migrations
- Auth: Lucia session auth
- Tests: Vitest + Testing Library

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

## Recent refactors
- 2026-02-15: split provider orchestration into focused services:
  - `server/services/provider-connections-service.ts`
  - `server/services/mailchannels-provisioning-service.ts`
  - `server/services/agentmail-provisioning-service.ts`
  - `server/services/provider-credentials-service.ts`
  - `server/services/provider-service.ts` now acts as a compatibility barrel
  - Added integration coverage in `tests/provider-services-refactor.test.ts`

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
- `APP_ENCRYPTION_KEY` (base64 preferred; dev fallback is used when missing)
- `CONNECTOR_MODE` (`mock` or `live`, default: `mock`)
- `MAILCHANNELS_BASE_URL` (default MailChannels API base)
- `AGENTMAIL_BASE_URL` (default AgentMail API base)
- `MAILCHANNELS_WEBHOOK_VERIFY` (`true`/`false`, default: `false`)
- `WEBHOOK_SHARED_SECRET` (optional webhook shared secret)

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
