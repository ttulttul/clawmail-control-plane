# Refactoring Opportunities

Generated: 2026-02-15

1. Split `server/services/provider-service.ts` by bounded context.
- Why: The file currently owns tenant connection storage, MailChannels lifecycle ops, AgentMail provisioning, credential assembly, and domain listing.
- Risk today: high cognitive load and broad blast radius for small edits.
- Recommended modules:
  - `provider-connections-service.ts`
  - `mailchannels-subaccount-service.ts`
  - `agentmail-resource-service.ts`
  - `provider-credentials-service.ts`

2. Extract shared AgentMail inbox resolution in `server/services/gateway-service.ts`.
- Why: `listInboxThreads`, `getInboxMessage`, and `replyInboxMessage` repeat the same lookup and credential checks.
- Risk today: behavior drift and inconsistent error handling over time.
- Proposed change: add a single helper (`loadAgentmailInboxAccess`) returning `{ inboxId, apiKey }` and reuse it.

3. Introduce route-level scope guard middleware for `server/agent/routes.ts`.
- Why: each handler rechecks `agentAuth` and scope rules manually.
- Risk today: missing checks on future endpoints.
- Proposed change: middleware/utility wrappers like `requireAgentScope("send")` and `requireAgentScope("read_inbox")`.

4. Normalize JSON column parsing/stringifying behind typed codecs.
- Why: JSON fields are serialized in many places (`scopesJson`, `requiredHeadersJson`, `recipientsJson`, `dnsRecordsJson`) with local parse helpers.
- Risk today: silent shape drift and repetitive defensive code.
- Proposed change: `server/lib/json-codec.ts` with typed helpers (`parseStringArray`, `parseUnknownRecord`, `stringifyJson`).

5. Break `src/routes/instances.tsx` into composable feature components.
- Why: a single route component handles creation, MailChannels provisioning, inbox provisioning, token rotation, and lifecycle controls.
- Risk today: harder targeted testing and more fragile UI state updates.
- Proposed components:
  - `InstanceCreateForm`
  - `InstanceRow`
  - `InstanceProvisionActions`
  - `TokenRotationPanel`

6. Add an internal provider façade to hide connector branching.
- Why: call sites currently know too much about MailChannels vs AgentMail operations and credential forms.
- Risk today: expanding provider support increases conditional complexity.
- Proposed change: define provider-domain interfaces (`OutboundMailProvider`, `MailboxProvider`) and map connectors behind those interfaces.

7. Expand integration tests around gateway policy and auth failure modes.
- Why: current tests validate crypto, tenant boundaries, and UI selection, but not gateway policy edge cases.
- Suggested matrix:
  - send blocked by missing required header
  - send blocked by deny-list domain
  - send blocked by per-minute limit
  - inbox read denied without `read_inbox` scope
  - token expiry and revoked-token behavior
