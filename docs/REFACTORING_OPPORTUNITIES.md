# Refactoring Opportunities

Generated: 2026-02-15

## Current Backlog
1. [ ] Extract credential field state machines into reusable hooks.
- Why: `src/routes/tenants.tsx` still carries complex per-field edit/lock/force-entry/feedback timing logic inline.
- Proposed change: Create `useCredentialFieldState` and `useCredentialValidationFeedback` hooks to isolate timing transitions and reduce route complexity.

2. [ ] Introduce a shared provider validation connector factory.
- Why: credential validation now intentionally bypasses `CONNECTOR_MODE` outside tests, but this policy currently lives inside one service file.
- Proposed change: Add `server/connectors/validation-factory.ts` to centralize validation connector selection and make behavior explicit.

3. [ ] Add schema-based parsing for provider read endpoints.
- Why: connector response normalization (`listSubaccounts`, `listPods`) currently probes multiple key names with manual checks.
- Proposed change: Use Zod schemas for tolerant parsing with explicit fallback branches and targeted unit tests.

4. [ ] Add route-level accessibility hooks for validation feedback states.
- Why: inline `✅`/`❌` feedback is visual-first; there is no dedicated non-visual status text for assistive tech.
- Proposed change: Add `aria-live` status text tied to each credential field and test it with Testing Library queries.

5. [ ] Split `TenantsRoute` into tenant-management and provider-connection panels.
- Why: tenant CRUD and provider credential UX are independent responsibilities and increase file size/mental load when combined.
- Proposed change: Extract `TenantManagementPanel` and `ProviderConnectionsPanel` components to keep route-level orchestration lightweight.

## Completed In This Branch
1. [x] Enforced live provider API validation for credentials in non-test runtime.
2. [x] Switched provider credential UX to inline validation states (shimmer, success/error overlays) without status-pill reflow.
3. [x] Removed rendering of raw provider error payloads from credential UI and extended failed-state visibility duration.
