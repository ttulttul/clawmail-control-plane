# Refactoring Opportunities

Generated: 2026-02-15

1. Consolidate authentication entrypoints behind an auth module boundary.
- Why: Auth logic is currently split across tRPC (`server/routers/auth.ts`) and Hono routes (`server/routes/oauth.ts`), which risks duplicated policy handling and makes auth behavior harder to reason about.
- Proposed change: Introduce an `server/auth/flows/` layer with shared functions for session creation, redirect/error mapping, and account linking. Keep HTTP adapters thin.

2. Introduce a synchronous DB transaction helper for account-linking paths.
- Why: SQLite with `better-sqlite3` is synchronous; async call patterns can accidentally bypass transactional guarantees.
- Proposed change: Add a small repository helper that executes auth-critical operations (`create-or-link-user`, `session issuance prerequisites`) inside sync-safe transactional boundaries.

3. Extract provider API calls from `server/routes/oauth.ts` into typed provider clients.
- Why: OAuth route currently handles HTTP calls, payload validation, and control flow in one file.
- Proposed change: Move Google/GitHub fetch and parsing into `server/services/oauth-providers/{google,github}.ts` with typed return contracts and shared error mapping.

4. Replace stringly-typed OAuth error codes with a typed enum map shared by server and UI.
- Why: Error keys are repeated in route handlers and frontend message maps, which can drift.
- Proposed change: Export a literal object of error codes from a shared module and consume it from both `server/routes/oauth.ts` and `src/components/auth-gate.tsx`.

5. Split `AuthGate` into local-credentials and SSO subcomponents.
- Why: `src/components/auth-gate.tsx` now manages local auth form state, OAuth launch logic, and error rendering in one component.
- Proposed change: Create `AuthGateLocalForm` and `AuthGateSsoButtons`, with a small parent orchestrator for shared errors.

6. Add integration tests for OAuth callback handlers with mocked provider responses.
- Why: Current tests validate parsing and account linking but not end-to-end callback behavior (state mismatch, cookie handling, redirect semantics).
- Proposed change: Add route-level tests that exercise `/auth/oauth/:provider/callback` with mocked fetch and assert session cookie + redirect outcomes.

7. Plan migration away from deprecated Lucia packages.
- Why: Current dependency versions emit deprecation warnings during install.
- Proposed change: Track and execute a phased migration plan to the recommended successor library while preserving session cookie semantics and DB compatibility.
