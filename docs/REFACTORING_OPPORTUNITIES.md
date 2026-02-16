# Refactoring Opportunities

Generated: 2026-02-16

## Current Backlog
1. [ ] Split `src/routes/tenants.tsx` into focused route-level panels.
- Why: `src/routes/tenants.tsx` is now 800+ lines and mixes tenant selection summary, first-tenant onboarding, and provider credential orchestration.
- Proposed change: Extract `TenantOverviewPanel`, `FirstTenantCreateForm`, and `ProviderConnectionsPanel` components so the route only composes state and query/mutation wiring.

2. [ ] Consolidate tenant creation UI logic into a shared hook.
- Why: Tenant creation now exists in both `src/components/tenant-selector.tsx` (modal) and `src/routes/tenants.tsx` (first-tenant inline form).
- Proposed change: Add `src/hooks/use-create-tenant.ts` to centralize mutation wiring, validation, and post-create selection behavior.

3. [ ] Replace provider credential edit state booleans with typed state machines.
- Why: The route currently uses multiple related booleans (`editing`, `forceEntry`, lock/frozen states) per credential field, which increases impossible-state risk.
- Proposed change: Use discriminated unions per field (for example `preview | editing | validating | rejected | accepted`) and derive rendering from one source of truth.

4. [ ] Extract reusable provider credential field components.
- Why: MailChannels and AgentMail field blocks duplicate input shell, feedback icon logic, edit/restore event handling, and hint rendering.
- Proposed change: Introduce a `CredentialField` component with typed props for provider-specific messages and mutation payload mapping.

5. [ ] Break `server/services/mailchannels-provisioning-service.ts` into domain modules.
- Why: The service is one of the largest backend files and combines connector calls, validation guards, and provisioning orchestration.
- Proposed change: Split into `mailchannels-subaccounts-service.ts`, `mailchannels-limits-service.ts`, and `mailchannels-keys-service.ts` while keeping the current export surface via a barrel module.

## Completed In This Branch
1. [x] Moved ongoing tenant creation UX to the workspace header tenant selector (`Create tenant...` modal flow).
2. [x] Removed duplicate tenant list rendering from `/tenants` and replaced it with selected-tenant summary.
3. [x] Kept first-tenant onboarding inline on `/tenants` only when no tenants exist.
