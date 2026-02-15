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

4. [ ] Formalize connector error mapping.
- Why: Connector failures currently surface mostly as generic errors from fetch paths.
- Proposed change: Add provider error mappers that convert provider status/response bodies into `TRPCError` codes (`BAD_REQUEST`, `CONFLICT`, `UNAUTHORIZED`, `TOO_MANY_REQUESTS`).

5. [ ] Break `src/routes/instances.tsx` into smaller components.
- Why: The page owns creation, provisioning, token rotation, and lifecycle actions in one component.
- Proposed change:
  - `InstanceCreateForm`
  - `InstanceList`
  - `InstanceActions`
  - `GatewayTokenPanel`

6. [ ] Move scheduler job logic into per-job handlers.
- Why: `server/jobs/scheduler.ts` mixes queue orchestration with job behavior.
- Proposed change: Keep scheduler generic and move job behavior into `server/jobs/handlers/*`, then register handlers by job type.

7. [ ] Add explicit integration tests for gateway policy enforcement.
- Why: Current tests cover crypto, tenant boundary, and UI behavior, but not `beforeSend` policy outcomes.
- Proposed test matrix:
  - missing required headers
  - per-minute limit exhaustion
  - daily cap exceeded
  - allow/deny domain matching
