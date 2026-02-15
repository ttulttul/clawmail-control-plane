# Refactoring Opportunities

Generated: 2026-02-15

1. [x] Split `server/services/provider-service.ts` into focused services. (Completed 2026-02-15)
- Why: This file currently combines connection persistence, provisioning, key rotation, usage sync, and domain listing, which increases coupling and test complexity.
- Completed split:
  - `provider-connections-service.ts`
  - `mailchannels-provisioning-service.ts`
  - `agentmail-provisioning-service.ts`
  - `provider-credentials-service.ts`

2. [x] Introduce a typed JSON helper layer for serialized columns. (Completed 2026-02-15)
- Why: Multiple files parse/stringify JSON arrays and objects manually (`requiredHeadersJson`, `recipientsJson`, etc.), duplicating parsing logic.
- Completed change: added `server/lib/json-codec.ts` with `parseStringArray`, `parseRecord`, `safeJson`, and `safeJsonStringify`, and replaced duplicated parse/stringify logic in services and routers handling serialized columns.

3. [x] Consolidate tenant/instance authorization checks into middleware wrappers. (Completed 2026-02-15)
- Why: Routers repeatedly call `requireTenantMembership` and `requireInstance` in each procedure.
- Completed change: Added composable tRPC wrappers in `server/trpc.ts` (`tenantMemberProcedure`, `tenantOperatorProcedure`, `tenantAdminProcedure`, `instanceScopedProcedure`, `instanceOperatorProcedure`) and migrated routers to remove repeated inline authorization checks.

4. [x] Formalize connector error mapping. (Completed 2026-02-15)
- Why: Connector failures currently surface mostly as generic errors from fetch paths.
- Completed change: Added `ProviderHttpError` and provider error mapping helpers to convert connector HTTP failures into typed `TRPCError` codes (`BAD_REQUEST`, `CONFLICT`, `UNAUTHORIZED`, `TOO_MANY_REQUESTS`, plus scoped fallbacks), and applied mapping across MailChannels and AgentMail call paths.

5. [x] Break `src/routes/instances.tsx` into smaller components. (Completed 2026-02-15)
- Why: The page owns creation, provisioning, token rotation, and lifecycle actions in one component.
- Completed split:
  - `InstanceCreateForm`
  - `InstanceList`
  - `InstanceActions`
  - `GatewayTokenPanel`

6. [x] Move scheduler job logic into per-job handlers. (Completed 2026-02-15)
- Why: `server/jobs/scheduler.ts` mixes queue orchestration with job behavior.
- Completed change: Added `server/jobs/handlers/*` with a typed handler registry and moved `sync-usage`/`validate-webhooks` behavior out of `server/jobs/scheduler.ts`, leaving scheduler focused on queue orchestration.

7. [x] Add explicit integration tests for gateway policy enforcement. (Completed 2026-02-15)
- Why: Current tests cover crypto, tenant boundary, and UI behavior, but not `beforeSend` policy outcomes.
- Completed test matrix (see `tests/gateway-policy-enforcement.test.ts`):
  - missing required headers
  - per-minute limit exhaustion
  - daily cap exceeded
  - allow/deny domain matching
