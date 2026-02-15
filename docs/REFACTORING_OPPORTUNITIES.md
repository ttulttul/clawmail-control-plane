# Refactoring Opportunities

Generated: 2026-02-15

## Current Backlog
1. [ ] Split tenant provider credential UI into focused components.
- Why: `src/routes/tenants.tsx` now mixes tenant CRUD, provider edit-state machines, validation feedback timing, and mutation orchestration in one large file.
- Proposed change: Extract `ProviderCredentialField`, `MailChannelsConnectionPanel`, and `AgentMailConnectionPanel` components with small typed prop contracts.

2. [ ] Create a reusable credential feedback state hook.
- Why: validation shimmer/success/error transitions rely on repeated per-field state updates and timeout cleanup logic.
- Proposed change: Add `src/hooks/use-credential-feedback.ts` with typed APIs for `startValidating`, `setSuccess`, `setError`, and `settle`.

3. [ ] Add a shared provider validation client boundary.
- Why: live validation in `server/services/provider-credential-validation-service.ts` now has runtime-specific connector selection that is distinct from provisioning connector selection.
- Proposed change: Introduce `server/connectors/validation-factory.ts` to centralize validation connector policy (`test` vs non-test) and reduce inline branching.

4. [ ] Strengthen MailChannels response parsing with schema validation.
- Why: `listSubaccounts` currently accepts multiple payload shapes with ad-hoc key probing.
- Proposed change: Parse provider responses with Zod schemas to make shape handling explicit and testable.

5. [ ] Add integration coverage for live-validation routing behavior.
- Why: existing tests verify UI transitions and tenant boundaries, but not the runtime branch that selects live validation connectors in non-test mode.
- Proposed change: Add service-level tests that mock fetch and assert live connector invocation and error mapping behavior.

6. [ ] Consolidate provider credential redaction/preview logic.
- Why: preview redaction is currently implemented in both backend preview service and route-level optimistic preview updates.
- Proposed change: expose a shared utility (`redactCredentialPreview`) on both server/client boundaries to guarantee consistent truncation behavior.

## Completed In This Branch
1. [x] Added direct provider API validation before credential persistence for MailChannels and AgentMail.
2. [x] Implemented inline credential validation UX (shimmer, success/error overlays, timed settle) without status-pill reflow.
3. [x] Added provider status preview query and editable redacted credential flow for configured tenant connections.
