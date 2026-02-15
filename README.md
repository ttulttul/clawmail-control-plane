![ClawMail banner](docs/images/banner.jpeg)

# ClawMail Control Plane

Self-hostable email control plane for OpenClaw fleets with tenant isolation, per-instance blast-radius controls, centralized webhook ingestion, and gateway-mode API access.

## Stack
- Frontend: Vite + React + TanStack Router
- Backend: Hono + tRPC
- Database: SQLite + Drizzle ORM + generated SQL migrations
- Auth: Lucia session auth + optional Google/GitHub OAuth
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
