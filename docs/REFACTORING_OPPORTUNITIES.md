# Refactoring Opportunities

Generated: 2026-02-15

1. Split `server/services/provider-service.ts` into focused services.
- Why: This file currently combines connection persistence, provisioning, key rotation, usage sync, and domain listing, which increases coupling and test complexity.
- Proposed split:
  - `provider-connections-service.ts`
  - `mailchannels-provisioning-service.ts`
  - `agentmail-provisioning-service.ts`
  - `provider-credentials-service.ts`

2. Introduce a typed JSON helper layer for serialized columns.
- Why: Multiple files parse/stringify JSON arrays and objects manually (`requiredHeadersJson`, `recipientsJson`, etc.), duplicating parsing logic.
- Proposed change: Add small codec utilities (`parseStringArray`, `parseRecord`, `safeJson`) and centralize null/shape handling.

3. Consolidate tenant/instance authorization checks into middleware wrappers.
- Why: Routers repeatedly call `requireTenantMembership` and `requireInstance` in each procedure.
- Proposed change: Add composable tRPC middlewares (`tenantMemberProcedure`, `tenantOperatorProcedure`, `instanceScopedProcedure`) to reduce repetition and enforce consistent error semantics.

4. Formalize connector error mapping.
- Why: Connector failures currently surface mostly as generic errors from fetch paths.
- Proposed change: Add provider error mappers that convert provider status/response bodies into `TRPCError` codes (`BAD_REQUEST`, `CONFLICT`, `UNAUTHORIZED`, `TOO_MANY_REQUESTS`).

5. Break `src/routes/instances.tsx` into smaller components.
- Why: The page owns creation, provisioning, token rotation, and lifecycle actions in one component.
- Proposed change:
  - `InstanceCreateForm`
  - `InstanceList`
  - `InstanceActions`
  - `GatewayTokenPanel`

6. Move scheduler job logic into per-job handlers.
- Why: `server/jobs/scheduler.ts` mixes queue orchestration with job behavior.
- Proposed change: Keep scheduler generic and move job behavior into `server/jobs/handlers/*`, then register handlers by job type.

7. Add explicit integration tests for gateway policy enforcement.
- Why: Current tests cover crypto, tenant boundary, and UI behavior, but not `beforeSend` policy outcomes.
- Proposed test matrix:
  - missing required headers
  - per-minute limit exhaustion
  - daily cap exceeded
  - allow/deny domain matching
