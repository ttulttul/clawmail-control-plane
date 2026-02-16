# Refactoring Opportunities

Generated: 2026-02-16

## Current Backlog
1. [ ] Split tenant route orchestration from credential field UI state in `src/routes/tenants.tsx`.
- Why: The route currently mixes tenant summary/onboarding concerns with provider status hydration, field edit/lock transitions, timeout lifecycle, and mutation success/error handling.
- Proposed change: Extract `TenantOverviewPanel`, `FirstTenantCreateForm`, and `ProviderCredentialsPanel`; keep `src/routes/tenants.tsx` focused on query/mutation composition.

2. [ ] Introduce a typed credential-feedback state machine hook.
- Why: `src/routes/tenants.tsx` handles repeated `validating -> success/error -> idle` transitions with multiple timeout refs and per-field conditionals.
- Proposed change: Add `useCredentialFeedbackMachine` to centralize transition timing, cleanup, and per-field updates.

3. [ ] Consolidate tenant creation UI logic into a shared hook.
- Why: Tenant creation now exists in both `src/components/tenant-selector.tsx` (modal) and `src/routes/tenants.tsx` (first-tenant inline form).
- Proposed change: Add `src/hooks/use-create-tenant.ts` to centralize validation, mutation wiring, cache invalidation, and post-create selection behavior.

4. [ ] Consolidate duplicated HTTP request/parsing logic in live provider connectors.
- Why: `LiveMailChannelsConnector` and `LiveAgentMailConnector` in `server/connectors/live.ts` each implement similar `fetch -> text -> ensureOk -> parse` behavior.
- Proposed change: Create a shared typed request helper used by both connectors to reduce divergence risk and simplify error handling updates.

5. [ ] Decompose `server/services/mailchannels-provisioning-service.ts` into operation-focused modules.
- Why: Provisioning, limit updates, status toggles, key rotation, usage sync, and webhook validation are all in one file with repeated connection/sub-account lookup patterns.
- Proposed change: Split into `mailchannels-provisioning/commands.ts`, `mailchannels-provisioning/key-lifecycle.ts`, and `mailchannels-provisioning/sync.ts` with shared lookup helpers.

6. [ ] Add reusable integration-test builders for tenant/provider scenarios.
- Why: `tests/tenants-route.test.tsx`, `tests/tenant-boundary.test.ts`, and provider-service tests each recreate similar tenant/instance/provider setup boilerplate.
- Proposed change: Add typed factories under `tests/helpers/fixtures.ts` for tenant, membership, provider connection, and instance records.

## Completed In This Branch
1. [x] Restored live provider credential validation behavior for `/tenants` in non-test runtime.
2. [x] Moved ongoing tenant creation UX to the workspace header tenant selector (`Create tenant...` modal flow).
3. [x] Removed duplicate tenant list rendering from `/tenants` and replaced it with selected-tenant summary.
4. [x] Kept first-tenant onboarding inline on `/tenants` only when no tenants exist.
