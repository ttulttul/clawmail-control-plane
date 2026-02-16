# Refactoring Opportunities

Updated: 2026-02-16

1. [ ] Decompose `src/routes/casts.tsx` into focused components and hooks.
- Why: The file is ~824 lines and mixes cast onboarding, provider credential forms, async feedback timing, and selection state in one route component.
- Proposed change: Extract `CastOverviewPanel`, `ProviderConnectionsPanel`, and a `useCredentialValidationFeedback` hook so the route composes behavior instead of owning every state transition.

2. [ ] Create a shared credential field primitive for provider forms.
- Why: MailChannels and AgentMail sections in `src/routes/casts.tsx` repeat similar lock/edit/preview/error UI patterns with near-identical event handling.
- Proposed change: Add a reusable `CredentialField` component in `src/components/` that handles preview mode, inline validation state, and replace-on-click affordances.

3. [ ] Split `server/services/provider-connections-service.ts` by provider domain.
- Why: The service currently contains persistence and validation logic for both MailChannels and AgentMail, which increases branching and coupling.
- Proposed change: Move provider-specific flows into `mailchannels-connections-service.ts` and `agentmail-connections-service.ts`, and keep the current file as a thin orchestration facade if needed.

4. [ ] Replace ad-hoc scope parsing in `server/trpc.ts` with typed procedure factories.
- Why: Membership and instance scope checks rely on `readInputId` and repeated middleware wiring; this is easy to drift as routers grow.
- Proposed change: Introduce typed `withCastScope` and `withInstanceScope` helpers that validate input once (Zod-backed) and annotate procedure context with verified scope IDs.

5. [ ] Consolidate MailChannels subaccount state transitions.
- Why: `server/services/mailchannels-provisioning-service.ts` repeats DB transaction patterns for activate/suspend/rotate/update operations.
- Proposed change: Add a small repository module to centralize subaccount + instance status transitions so lifecycle invariants are enforced in one place.

6. [ ] Add shared integration-test fixture builders for cast/provider scenarios.
- Why: `tests/casts-route.test.tsx`, `tests/cast-boundary.test.ts`, and provider service tests recreate similar setup for users, casts, memberships, and provider credentials.
- Proposed change: Add typed factories under `tests/helpers/fixtures.ts` for cast membership, instance, and provider connection records.
