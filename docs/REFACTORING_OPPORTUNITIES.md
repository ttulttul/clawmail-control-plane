# Refactoring Opportunities

Generated: 2026-02-15

## Current Backlog
1. [ ] Extract tenant credential field orchestration from `src/routes/tenants.tsx`.
- Why: The route currently combines tenant CRUD, provider input lock/edit transitions, inline feedback timing, and mutation behavior in one file.
- Proposed change: Split into focused panels (`TenantManagementPanel`, `ProviderConnectionsPanel`) and reusable credential-field components.

2. [ ] Add a reusable hook for timed validation feedback states.
- Why: Success and error state transitions depend on multiple timeout refs and repeated state updates.
- Proposed change: Introduce `useTimedCredentialFeedback` to standardize `validating -> success/error -> idle` transitions with cleanup.

3. [ ] Consolidate provider rejection copy into a shared UI constant map.
- Why: Provider-specific rejection strings are now inline in route logic.
- Proposed change: Move copy to a dedicated typed config (`src/lib/provider-feedback.ts`) to centralize wording and reduce duplication risk.

4. [ ] Isolate validation connector selection policy.
- Why: Credential validation intentionally uses live connectors outside `test`; this policy is currently embedded in one service.
- Proposed change: Add `server/connectors/validation-factory.ts` and use it from validation service for clearer intent and easier testing.

5. [ ] Add schema-driven parsing for provider listing endpoints.
- Why: `listSubaccounts` and `listPods` parse flexible provider payloads with manual key checks.
- Proposed change: Use Zod schemas with tolerant transforms to make accepted payload shapes explicit and testable.

## Completed In This Branch
1. [x] Enforced live provider API validation for credentials in non-test runtime.
2. [x] Implemented inline credential validation UX with shimmering processing, success, and failure overlays.
3. [x] Removed raw provider error payload rendering and replaced it with concise provider-specific rejection feedback text.
