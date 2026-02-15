## Dev environment tips
- This is a TypeScript monorepo managed with pnpm workspaces; if `node_modules` looks stale, run `pnpm install`.
- The `rg` command is installed; use it for quick searching.
- This is a MacOS environment.
- The git server we use is Bitbucket.
- Commit every change you make and ask the user to push changes when a significant batch of changes has been made.
- Update README.md with each major commit.

## Architecture overview
- **Frontend:** Vite + React + TanStack Router (file-based routing under `src/routes/`).
- **Backend:** Hono running on Node (single `server/` entry point), exposed via tRPC for typed API calls.
- **Database:** SQLite via better-sqlite3, schema and queries managed by Drizzle ORM (`drizzle/schema.ts`).
- **Auth:** Lucia for session-based authentication, backed by the same SQLite database.
- **Deployment target:** Single Docker container (static assets served by Hono in production). Keep the footprint small and self-hostable.

## Dev process tips
- Use `console.warn` and `console.error` sparingly in application code; prefer structured logging via a lightweight logger (e.g., `pino` or `consola`) attached to the Hono context so every request carries a correlation ID.
- In most cases where an error condition is encountered, throw an appropriate `TRPCError` with a meaningful `code` (`BAD_REQUEST`, `NOT_FOUND`, `UNAUTHORIZED`, etc.) and a human-readable `message`. We want to know what went wrong and where.
- Whenever the last commit hash starts with the letter a, b, c, d, or e, analyze the codebase for opportunities to refactor things, noting your recommendations in `docs/REFACTORING_OPPORTUNITIES.md`, replacing that file if it already exists.
- Use pnpm as the package manager. Keep a single `pnpm-lock.yaml` at the repo root.

## Type safety
- Type-checking is non-optional: Enable `"strict": true` in `tsconfig.json` (which implies `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, etc.). No `any` unless it is isolated behind a thin, well-typed boundary and accompanied by a `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a justification comment.

- Use TypeScript's type system to its full extent by default: Prefer `interface` for object shapes and public contracts; use `type` for unions, intersections, and mapped/conditional types; use `as const` for closed literal sets; use discriminated unions (`type Result = { ok: true; data: T } | { ok: false; error: E }`) to make impossible states unrepresentable; use branded types (e.g., `type UserId = string & { __brand: "UserId" }`) for domain identifiers that must not be mixed up.

- Leverage the end-to-end type pipeline the stack provides:
  - **Drizzle** schema → inferred row types (`typeof users.$inferSelect`, `typeof users.$inferInsert`). Never hand-write a type that duplicates what Drizzle already infers.
  - **tRPC** routers → inferred input/output types flow automatically to the client via `trpc.useQuery` / `trpc.useMutation`. Never duplicate request/response shapes on the client.
  - **TanStack Router** → route params and search params should be typed via the route definition's `validateSearch` / `parseParams`. No bare `string` casts for route params.
  - **Lucia** → session and user types are declared once in `lucia.d.ts` and flow through middleware and route context.

- Runtime validation complements static types: Validate all external inputs at the boundary (tRPC procedure inputs, env vars, HTTP headers, form data) with Zod schemas, and let tRPC's `.input(z.object({...}))` handle parsing. Return strongly-typed domain objects from procedures; do not let untyped `Record<string, unknown>` leak into core logic.

- Make type safety enforceable in CI: Run `tsc --noEmit`, `eslint`, and `vitest` before every commit and fail the build on: missing annotations, implicit `any`, unsafe type assertions (`as` without justification), untyped third-party modules (add or write `.d.ts` stubs), or unchecked `@ts-ignore` / `@ts-expect-error` (must include a reason and be scoped to one line).

- Design for type-driven correctness: Separate pure functions from I/O, keep functions small with precise signatures, use function overloads or generic constraints where behavior depends on input types, and write tests that assert types at key boundaries (parsing/validation, tRPC procedure outputs, Drizzle query results).

## Project structure conventions
```
├── src/                    # Frontend (Vite + React)
│   ├── routes/             # TanStack Router file-based routes
│   ├── components/         # Shared UI components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Client-side utilities (trpc client, auth helpers)
│   └── main.tsx
├── server/                 # Backend (Hono + tRPC)
│   ├── routers/            # tRPC routers (one file per domain)
│   ├── middleware/          # Hono/tRPC middleware (auth, logging)
│   ├── services/           # Business logic (pure functions + DB calls)
│   ├── db.ts               # Drizzle client instance
│   └── index.ts            # Hono app entry point
├── drizzle/
│   ├── schema.ts           # Single source of truth for DB schema
│   └── migrations/         # Generated migration SQL files
├── drizzle.config.ts
├── vite.config.ts
├── tsconfig.json
└── Dockerfile
```
- Keep tRPC routers thin: validate input, call a service, return the result. Business logic lives in `server/services/`.
- One Drizzle schema file is fine until it isn't; split by domain (e.g., `schema/users.ts`, `schema/posts.ts`) when the file exceeds ~200 lines.

## Database conventions
- Always generate migrations with `pnpm drizzle-kit generate` after schema changes; never hand-edit migration files.
- Run `pnpm drizzle-kit migrate` (or the programmatic equivalent on server start) to apply pending migrations.
- Use Drizzle's query builder for all database access. Raw SQL is acceptable only for performance-critical queries and must be wrapped in a typed helper that returns a well-defined type.
- SQLite doesn't enforce foreign keys by default; ensure `PRAGMA foreign_keys = ON` is set when the connection is created.

## Auth conventions
- Lucia owns session management. Do not roll custom session cookies or JWT logic.
- Protect tRPC procedures via a shared `protectedProcedure` that reads the session from the Hono context and throws `UNAUTHORIZED` if absent.
- Store the Lucia `User` and `Session` types in a single `lucia.d.ts` declaration file so they are consistent across server and client.

## Testing instructions
- Add or update tests for the code you change, even if nobody asked.
- Use Vitest for all tests (unit, integration, and component).
- For tRPC routers, prefer integration tests that call the procedure through `createCaller` with a real (in-memory or temp-file) SQLite database so Drizzle queries are exercised.
- For React components, use `@testing-library/react`; avoid testing implementation details.
- Aim for fast, deterministic tests. SQLite's in-memory mode (`:memory:`) makes DB-backed tests cheap—use it.