# Refactoring Opportunities

Generated: 2026-02-15

## Current Backlog
1. [ ] Consolidate authentication entrypoints behind an auth module boundary.
- Why: Auth logic is split across tRPC (`server/routers/auth.ts`) and Hono routes (`server/routes/oauth.ts`), which risks duplicated policy handling.
- Proposed change: Introduce `server/auth/flows/` with shared functions for session creation, redirect/error mapping, and account linking.

2. [ ] Introduce a synchronous DB transaction helper for account-linking paths.
- Why: SQLite with `better-sqlite3` is synchronous; async call patterns can bypass transactional guarantees.
- Proposed change: Add a repository helper for auth-critical operations inside sync-safe transactional boundaries.

3. [ ] Extract provider API calls from `server/routes/oauth.ts` into typed provider clients.
- Why: OAuth route currently handles HTTP calls, payload validation, and control flow in one file.
- Proposed change: Move Google/GitHub fetch/parsing into `server/services/oauth-providers/{google,github}.ts` with typed contracts.

4. [ ] Replace stringly-typed OAuth error codes with a typed enum map shared by server and UI.
- Why: Error keys are repeated in route handlers and frontend message maps.
- Proposed change: Export a literal error-code map consumed by `server/routes/oauth.ts` and `src/components/auth-gate.tsx`.

5. [ ] Split `AuthGate` into local-credentials and SSO subcomponents.
- Why: `src/components/auth-gate.tsx` manages local auth form state, OAuth launch logic, and error rendering together.
- Proposed change: Create `AuthGateLocalForm` and `AuthGateSsoButtons` with a small parent orchestrator.

6. [ ] Add integration tests for OAuth callback handlers with mocked provider responses.
- Why: Current tests validate parsing/account linking but not callback end-to-end behavior.
- Proposed change: Add route-level tests for `/auth/oauth/:provider/callback` with mocked fetch and cookie/redirect assertions.

7. [ ] Plan migration away from deprecated Lucia packages.
- Why: Current dependency versions emit deprecation warnings during install.
- Proposed change: Track and execute a phased migration plan that preserves cookie semantics and DB compatibility.

8. [ ] Extract shared AgentMail inbox access resolution from `server/services/gateway-service.ts`.
- Why: `listInboxThreads`, `getInboxMessage`, and `replyInboxMessage` duplicate inbox + credential resolution flow.
- Proposed change: Add `loadInboxAccessOrThrow(db, tenantId, instanceId)` and centralize error mapping.

9. [ ] Add scoped middleware helpers for `/agent` endpoints in `server/agent/routes.ts`.
- Why: Agent routes repeat auth null checks and scope checks (`send`, `read_inbox`).
- Proposed change: Introduce reusable guards such as `requireAuthenticatedAgent` and `requireAgentScope("send")`.

## Completed In This Branch
1. [x] Split provider orchestration into focused modules (`provider-connections`, `mailchannels-provisioning`, `agentmail-provisioning`, `provider-credentials`) and converted `provider-service.ts` to a compatibility barrel.
2. [x] Introduced typed JSON codecs (`server/lib/json-codec.ts`) and replaced ad hoc parse/stringify calls in policy, token, send-log, audit-log, and domain flows.
3. [x] Added composable tRPC authorization wrappers (`tenantMemberProcedure`, `tenantOperatorProcedure`, `tenantAdminProcedure`, `instanceScopedProcedure`, `instanceOperatorProcedure`) and removed repeated inline checks from routers.
4. [x] Added provider error mapping (`ProviderHttpError` + `withProviderErrorMapping`) to convert provider HTTP failures into explicit `TRPCError` codes.
5. [x] Split `src/routes/instances.tsx` responsibilities into focused components (`InstanceCreateForm`, `InstanceList`, `InstanceActions`, `GatewayTokenPanel`) while preserving UX feedback patterns.
6. [x] Moved scheduler job behavior into typed handler modules under `server/jobs/handlers/*`, keeping `server/jobs/scheduler.ts` focused on queue orchestration.
7. [x] Added explicit gateway policy integration coverage for required headers, per-minute limits, daily caps, and allow/deny domain matching.
