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
    // We only need user id for protectedProcedure checks in this test.
    user: { id: userId } as AuthVariables["user"],
    session: { id: `session-${userId}` } as AuthVariables["session"],
  };
}

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = join(
    tmpdir(),
    `clawmail-test-${Date.now()}-${randomUUID()}.db`,
  );

  const [routers, dbModule, loggerModule] = await Promise.all([
    import("../server/routers/_app"),
    import("../server/lib/db"),
    import("../server/lib/logger"),
  ]);

  modules = {
    appRouter: routers.appRouter,
    db: dbModule.db,
    closeDatabase: dbModule.closeDatabase,
    createRequestLogger: loggerModule.createRequestLogger,
  };
});

afterAll(() => {
  modules.closeDatabase();
});

describe("risk boundary", () => {
  test("blocks cross-risk instance access", async () => {
    const anonymousCaller = modules.appRouter.createCaller(
      buildContext(null, modules.createRequestLogger("anon")),
    );

    const userOne = await anonymousCaller.auth.register({
      email: "owner-one@example.com",
      password: "super-secure-password-1",
    });

    const userTwo = await anonymousCaller.auth.register({
      email: "owner-two@example.com",
      password: "super-secure-password-2",
    });

    const userOneCaller = modules.appRouter.createCaller(
      buildContext(
        createAuth(userOne.userId),
        modules.createRequestLogger("user-1"),
      ),
    );

    const userTwoCaller = modules.appRouter.createCaller(
      buildContext(
        createAuth(userTwo.userId),
        modules.createRequestLogger("user-2"),
      ),
    );

    const [riskOne, riskTwo] = await Promise.all([
      userOneCaller.risks.create({ name: "Risk One" }),
      userTwoCaller.risks.create({ name: "Risk Two" }),
    ]);

    const riskOneId = riskOne.riskId;
    const riskTwoId = riskTwo.riskId;

    await userOneCaller.instances.create({
      riskId: riskOneId,
      name: "Alpha Instance",
      mode: "gateway",
    });

    await expect(
      userOneCaller.instances.list({ riskId: riskTwoId }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  test("returns redacted provider credential previews only to risk members", async () => {
    const anonymousCaller = modules.appRouter.createCaller(
      buildContext(null, modules.createRequestLogger("anon-preview")),
    );

    const owner = await anonymousCaller.auth.register({
      email: "owner-preview@example.com",
      password: "super-secure-password-owner-preview",
    });

    const outsider = await anonymousCaller.auth.register({
      email: "outsider-preview@example.com",
      password: "super-secure-password-outsider-preview",
    });

    const ownerCaller = modules.appRouter.createCaller(
      buildContext(
        createAuth(owner.userId),
        modules.createRequestLogger("owner-preview"),
      ),
    );

    const outsiderCaller = modules.appRouter.createCaller(
      buildContext(
        createAuth(outsider.userId),
        modules.createRequestLogger("outsider-preview"),
      ),
    );

    const { riskId } = await ownerCaller.risks.create({
      name: "Preview Risk",
    });

    await ownerCaller.risks.connectMailchannels({
      riskId,
      accountId: "mcacct_123456",
      parentApiKey: "secret-parent-key",
    });

    await ownerCaller.risks.connectAgentmail({
      riskId,
      apiKey: "agentmail-secret-key",
    });

    const preview = await ownerCaller.risks.providerStatus({ riskId });
    expect(preview).toEqual({
      mailchannelsAccountId: "mcacct...",
      mailchannelsParentApiKey: "secret...",
      agentmailApiKey: "agentm...",
    });

    await expect(
      outsiderCaller.risks.providerStatus({ riskId }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
