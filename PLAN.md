# ClawMail Control Plane Build Plan

## Objective
Build the self-hostable control plane described in `PRD.md`, prioritizing the MVP slice first, then extending to full operational controls and observability.

## Build Order

### Phase 0: Foundation and Project Setup
1. Initialize pnpm monorepo workspace and root tooling.
2. Add strict TypeScript configuration (`strict: true`) and shared lint/test config.
3. Scaffold app structure:
   - `src/` (Vite + React + TanStack Router)
   - `server/` (Hono + tRPC)
   - `drizzle/` (schema + migrations)
4. Add Docker baseline and environment configuration scaffolding.

### Phase 1: Data Layer and Core Infrastructure
1. Define Drizzle SQLite schema for:
   - auth/tenancy
   - provider connections
   - instances/subaccounts/inboxes/tokens
   - send/event/audit logs
   - job queue and policy tables
2. Implement DB bootstrap (`PRAGMA foreign_keys = ON`) and migration wiring.
3. Implement encryption utility for provider secrets (AES-256-GCM + key versioning).
4. Add structured logger with per-request correlation ID middleware.

### Phase 2: Auth, RBAC, and API Skeleton
1. Integrate Lucia session auth and user/session typing.
2. Build Hono app entrypoint with middleware stack (logger, auth context, error handling).
3. Build tRPC context and base procedures:
   - `publicProcedure`
   - `protectedProcedure`
   - role-scoped risk guard helpers
4. Implement base routers and Zod-validated inputs:
   - `auth.*`
   - `risks.*`
   - `instances.*`
   - `logs.*`

### Phase 3: Provider Connectors and Provisioning (MVP Core)
1. Implement provider connector interfaces:
   - `MailChannelsConnector`
   - `AgentMailConnector`
2. Add service-layer provisioning flow:
   - create MailChannels sub-account
   - set limit / suspend / activate
   - create sub-account key and capture secret-once
   - create AgentMail pod/domain/inbox mapping
3. Add tRPC procedures:
   - `mailchannels.*`
   - `agentmail.*`
4. Persist audit log entries for security-sensitive actions.

### Phase 4: Agent Gateway Mode (MVP Delivery Path)
1. Implement instance token model and auth middleware for agent endpoints.
2. Implement gateway endpoints:
   - `POST /agent/send`
   - `GET /agent/events`
   - inbox read/reply stubs with typed contracts
3. Add policy engine hooks (`beforeSend`, `afterEvent`) with default rules:
   - rate limits (token bucket)
   - daily caps
   - required headers
   - recipient allow/deny checks
4. Add send/event logging and request correlation propagation.

### Phase 5: Webhooks, Jobs, and Reliability
1. Implement MailChannels webhook enrollment + validation services.
2. Implement webhook ingestion endpoints:
   - `/webhooks/mailchannels`
   - `/webhooks/agentmail`
3. Add signature verification pipeline and dedupe strategy.
4. Implement DB-backed job runner for:
   - usage sync
   - webhook validation
   - auto-remediation actions

### Phase 6: Frontend Operator UI
1. Build authenticated shell and risk selection.
2. Implement pages:
   - Dashboard
   - Risks
   - Instances (provisioning wizard + controls)
   - Domains
   - Webhooks
   - Audit/Logs
3. Add tRPC client wiring and typed route/search params.
4. Add instance config output view for Gateway and Direct modes.

### Phase 7: Hardening, Testing, and Packaging
1. Add integration tests for tRPC routers using SQLite test DB.
2. Add unit tests for policy engine, encryption, and token auth.
3. Add component tests for critical UI paths.
4. Validate `pnpm lint`, `pnpm tsc --noEmit`, and `pnpm vitest`.
5. Finalize Docker image, README, and runbook notes.

## Parallel Workstreams (Sub-agent style)
To accelerate delivery, work is split into these concurrent tracks where dependencies allow:
1. **Backend Core Track**: schema, auth, tRPC, connectors, gateway.
2. **Frontend Track**: route shell, pages, forms, and typed clients.
3. **Quality Track**: tests, fixtures, CI scripts, and lint/type gates.

## MVP Exit Criteria
MVP is complete when all of the following are true:
1. Operator can onboard risk/provider credentials and provision an instance.
2. Instance has isolated MailChannels sub-account + key + limit controls.
3. Instance has AgentMail inbox mapping.
4. Agent can send via `POST /agent/send` using scoped token.
5. Sends and inbound webhooks are logged and queryable in UI/API.
