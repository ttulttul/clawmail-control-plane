# Refactoring Opportunities

Updated: 2026-02-16

1. [ ] Split `src/routes/risks.tsx` into focused presentation and state layers.
- Why: The route is large (~824 lines) and currently mixes onboarding, provider credential UX, validation timing, and state-reset orchestration.
- Proposed change: Extract `RiskOverviewPanel`, `ProviderConnectionsPanel`, and a `useCredentialFeedback` hook so route logic stays composition-focused.

2. [ ] Introduce a shared credential input component for provider forms.
- Why: MailChannels and AgentMail sections in `src/routes/risks.tsx` repeat the same preview/edit/lock/feedback behavior with near-duplicate handlers.
- Proposed change: Add a reusable `CredentialInputField` component under `src/components/` with typed props for tone, lock state, replacement mode, and helper copy.

3. [ ] Extract provider connection orchestration by provider domain.
- Why: `server/services/provider-connections-service.ts` handles both MailChannels and AgentMail persistence + validation paths, increasing coupling and branch complexity.
- Proposed change: Split into `mailchannels-connections-service.ts` and `agentmail-connections-service.ts`, keeping a thin façade where cross-provider coordination is required.

4. [ ] Move tRPC scope wiring to typed procedure factories.
- Why: `server/trpc.ts` still relies on manual `readInputId` extraction and middleware wiring for risk and instance scoping.
- Proposed change: Introduce Zod-backed helpers like `withRiskScope` and `withInstanceScope` that validate once and enrich context with verified scope IDs.

5. [ ] Consolidate MailChannels subaccount state transitions behind a repository helper.
- Why: `server/services/mailchannels-provisioning-service.ts` repeats transaction patterns for activate/suspend/rotate/update flows.
- Proposed change: Create a typed repository module for subaccount lifecycle writes to centralize invariants and reduce duplicate transaction code.

6. [ ] Add shared test fixtures for risk/provider/integration setup.
- Why: Integration tests in `tests/risks-route.test.tsx`, `tests/risk-boundary.test.ts`, and provider service tests repeat setup boilerplate for users, memberships, providers, and instances.
- Proposed change: Add typed builders under `tests/helpers/fixtures.ts` for risk, membership, provider connections, and instance records.
