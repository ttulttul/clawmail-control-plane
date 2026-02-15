# Refactoring Opportunities

Generated: 2026-02-15

1. Extract shared AgentMail inbox access resolution from `server/services/gateway-service.ts`.
- Why: `listInboxThreads`, `getInboxMessage`, and `replyInboxMessage` duplicate the same inbox + credential resolution flow.
- Recommendation: add `loadInboxAccessOrThrow(db, tenantId, instanceId)` and centralize error mapping there.

2. Split `server/services/provider-service.ts` into focused modules.
- Why: this service currently owns connection persistence, provisioning, lifecycle operations, key management, usage sync, and credential composition.
- Recommendation: split by domain (`provider-connections`, `mailchannels-subaccounts`, `agentmail-provisioning`, `provider-credentials`).

3. Add scoped middleware helpers for `/agent` endpoints in `server/agent/routes.ts`.
- Why: each route repeats agent auth null checks + scope checks (`send`, `read_inbox`).
- Recommendation: introduce reusable guards (for example `requireAuthenticatedAgent`, `requireAgentScope("send")`) to reduce repeated logic and prevent drift.

4. Unify JSON (de)serialization helpers for Drizzle text columns.
- Why: JSON fields (`requiredHeadersJson`, `allowListJson`, `denyListJson`, `recipientsJson`, `dnsRecordsJson`, `scopesJson`) are parsed/stringified ad hoc.
- Recommendation: provide typed codecs in `server/lib/json.ts` with strict shape checking and consistent fallback behavior.

5. Move provider error translation closer to connector boundaries.
- Why: provider failures currently bubble as generic errors in many paths, which weakens operational diagnosis.
- Recommendation: map provider responses to explicit `TRPCError` codes/messages in connector adapters so service layers receive normalized failures.

6. Decompose `src/routes/instances.tsx` into presentational and mutation-focused components.
- Why: instance creation, sub-account provisioning, inbox provisioning, token rotation, and state controls all live in one route component.
- Recommendation: split into `InstanceCreateForm`, `InstanceList`, `InstanceActions`, and `TokenRotationNotice` for easier testing and maintenance.

7. Expand integration coverage for gateway guardrails.
- Why: tests currently validate tenant boundaries and utilities but do not deeply exercise gateway policy/scope failure modes.
- Recommendation: add integration tests for missing required headers, deny-list blocks, per-minute throttling, expired/revoked tokens, and missing inbox linkage.
