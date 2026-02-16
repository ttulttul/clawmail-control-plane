# Refactoring Opportunities

Generated: 2026-02-16

## Current Backlog
1. [ ] Split tenant route orchestration from credential field UI state in `src/routes/tenants.tsx`.
- Why: The route currently mixes tenant CRUD, provider status hydration, field edit/lock transitions, timeout lifecycle, and mutation success/error handling.
- Proposed change: Extract `TenantProvisioningPanel` + `ProviderCredentialsPanel` components and move credential transition logic into a dedicated hook.

2. [ ] Introduce a typed credential-feedback state machine hook.
- Why: `src/routes/tenants.tsx` handles repeated `validating -> success/error -> idle` state transitions with multiple timeout refs and per-field conditionals.
- Proposed change: Add `useCredentialFeedbackMachine` that centralizes transition timing, cleanup, and per-field updates.

3. [ ] Consolidate duplicated HTTP request/parsing logic in live provider connectors.
- Why: `LiveMailChannelsConnector` and `LiveAgentMailConnector` in `server/connectors/live.ts` each implement near-identical `fetch -> text -> ensureOk -> parse` behavior.
- Proposed change: Create a shared typed request helper (or base class) used by both connectors to reduce divergence risk and simplify error handling updates.

4. [ ] Decompose `server/services/mailchannels-provisioning-service.ts` into operation-focused modules.
- Why: Provisioning, limit updates, status toggles, key rotation, usage sync, and webhook validation are all in one file with repeated connection/sub-account lookup patterns.
- Proposed change: Split into `mailchannels-provisioning/commands.ts`, `mailchannels-provisioning/key-lifecycle.ts`, and `mailchannels-provisioning/sync.ts` with shared lookup helpers.

5. [ ] Add reusable integration-test builders for tenant/provider scenarios.
- Why: `tests/tenants-route.test.tsx`, `tests/tenant-boundary.test.ts`, and provider-service tests each recreate similar tenant/instance/provider setup boilerplate.
- Proposed change: Add typed test factories (tenant, membership, provider connection, instance) under `tests/helpers/fixtures.ts` to reduce duplication and improve readability.
