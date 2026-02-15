/* @vitest-environment node */

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { AuthVariables } from "../server/types/hono";
import type { RequestLogger } from "../server/lib/logger";

interface LoadedModules {
  appRouter: (typeof import("../server/routers/_app"))["appRouter"];
  db: (typeof import("../server/lib/db"))["db"];
  closeDatabase: (typeof import("../server/lib/db"))["closeDatabase"];
  createRequestLogger: (typeof import("../server/lib/logger"))["createRequestLogger"];
  createId: (typeof import("../server/lib/id"))["createId"];
  tenantMemberships: (typeof import("../drizzle/schema"))["tenantMemberships"];
}

let modules: LoadedModules;

function buildContext(
  auth: AuthVariables | null,
  logger: RequestLogger,
): {
  db: LoadedModules["db"];
  logger: RequestLogger;
  requestId: string;
  auth: AuthVariables | null;
  resHeaders: Headers;
} {
  return {
    db: modules.db,
    logger,
    requestId: randomUUID(),
    auth,
    resHeaders: new Headers(),
  };
}

function createAuth(userId: string): AuthVariables {
  return {
    user: { id: userId } as AuthVariables["user"],
    session: { id: `session-${userId}` } as AuthVariables["session"],
  };
}

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = join(
    tmpdir(),
    `clawmail-trpc-authz-${Date.now()}-${randomUUID()}.db`,
  );

  const [routers, dbModule, loggerModule, idModule, schemaModule] = await Promise.all([
    import("../server/routers/_app"),
    import("../server/lib/db"),
    import("../server/lib/logger"),
    import("../server/lib/id"),
    import("../drizzle/schema"),
  ]);

  modules = {
    appRouter: routers.appRouter,
    db: dbModule.db,
    closeDatabase: dbModule.closeDatabase,
    createRequestLogger: loggerModule.createRequestLogger,
    createId: idModule.createId,
    tenantMemberships: schemaModule.tenantMemberships,
  };
});

afterAll(() => {
  modules.closeDatabase();
});

describe("tRPC authorization procedures", () => {
  test("enforces member, operator, and instance scope checks", async () => {
    const anonymousCaller = modules.appRouter.createCaller(
      buildContext(null, modules.createRequestLogger("anon")),
    );

    const owner = await anonymousCaller.auth.register({
      email: "owner-authz@example.com",
      password: "super-secure-password-owner",
    });

    const viewer = await anonymousCaller.auth.register({
      email: "viewer-authz@example.com",
      password: "super-secure-password-viewer",
    });

    const outsider = await anonymousCaller.auth.register({
      email: "outsider-authz@example.com",
      password: "super-secure-password-outsider",
    });

    const ownerCaller = modules.appRouter.createCaller(
      buildContext(
        createAuth(owner.userId),
        modules.createRequestLogger("owner"),
      ),
    );

    const viewerCaller = modules.appRouter.createCaller(
      buildContext(
        createAuth(viewer.userId),
        modules.createRequestLogger("viewer"),
      ),
    );

    const outsiderCaller = modules.appRouter.createCaller(
      buildContext(
        createAuth(outsider.userId),
        modules.createRequestLogger("outsider"),
      ),
    );

    const { tenantId } = await ownerCaller.tenants.create({
      name: "Authz Tenant",
    });

    const { instanceId } = await ownerCaller.instances.create({
      tenantId,
      name: "Authz Instance",
      mode: "gateway",
    });

    await modules.db.insert(modules.tenantMemberships).values({
      id: modules.createId(),
      tenantId,
      userId: viewer.userId,
      role: "viewer",
    });

    const visibleInstances = await viewerCaller.instances.list({ tenantId });
    expect(visibleInstances.map((instance) => instance.id)).toContain(instanceId);

    await expect(
      viewerCaller.instances.create({
        tenantId,
        name: "Should Be Blocked",
        mode: "gateway",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      outsiderCaller.logs.sends({ tenantId, limit: 10 }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    await expect(
      ownerCaller.instances.getPolicy({
        tenantId,
        instanceId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
