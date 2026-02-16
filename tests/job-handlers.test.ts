/* @vitest-environment node */

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

interface LoadedModules {
  db: (typeof import("../server/lib/db"))["db"];
  closeDatabase: (typeof import("../server/lib/db"))["closeDatabase"];
  createRequestLogger: (typeof import("../server/lib/logger"))["createRequestLogger"];
  createId: (typeof import("../server/lib/id"))["createId"];
  hashPassword: (typeof import("../server/lib/password"))["hashPassword"];
  users: (typeof import("../drizzle/schema"))["users"];
  mailchannelsSubaccounts: (typeof import("../drizzle/schema"))["mailchannelsSubaccounts"];
  createCastForUser: (typeof import("../server/services/cast-service"))["createCastForUser"];
  createInstance: (typeof import("../server/services/instance-service"))["createInstance"];
  saveMailchannelsConnection: (typeof import("../server/services/provider-connections-service"))["saveMailchannelsConnection"];
  provisionMailchannelsSubaccount: (typeof import("../server/services/mailchannels-provisioning-service"))["provisionMailchannelsSubaccount"];
  jobHandlers: (typeof import("../server/jobs/handlers"))["jobHandlers"];
}

let modules: LoadedModules;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.CONNECTOR_MODE = "mock";
  process.env.DATABASE_URL = join(
    tmpdir(),
    `clawmail-job-handlers-${Date.now()}-${randomUUID()}.db`,
  );

  const [
    dbModule,
    loggerModule,
    idModule,
    passwordModule,
    schemaModule,
    castService,
    instanceService,
    connectionService,
    mailchannelsService,
    handlersModule,
  ] = await Promise.all([
    import("../server/lib/db"),
    import("../server/lib/logger"),
    import("../server/lib/id"),
    import("../server/lib/password"),
    import("../drizzle/schema"),
    import("../server/services/cast-service"),
    import("../server/services/instance-service"),
    import("../server/services/provider-connections-service"),
    import("../server/services/mailchannels-provisioning-service"),
    import("../server/jobs/handlers"),
  ]);

  modules = {
    db: dbModule.db,
    closeDatabase: dbModule.closeDatabase,
    createRequestLogger: loggerModule.createRequestLogger,
    createId: idModule.createId,
    hashPassword: passwordModule.hashPassword,
    users: schemaModule.users,
    mailchannelsSubaccounts: schemaModule.mailchannelsSubaccounts,
    createCastForUser: castService.createCastForUser,
    createInstance: instanceService.createInstance,
    saveMailchannelsConnection: connectionService.saveMailchannelsConnection,
    provisionMailchannelsSubaccount:
      mailchannelsService.provisionMailchannelsSubaccount,
    jobHandlers: handlersModule.jobHandlers,
  };
});

afterAll(() => {
  modules.closeDatabase();
});

describe("job handlers", () => {
  test("executes sync-usage and validate-webhooks handlers via registry", async () => {
    const userId = modules.createId();

    await modules.db.insert(modules.users).values({
      id: userId,
      email: `jobs-${userId}@example.com`,
      passwordHash: modules.hashPassword("super-secure-password"),
    });

    const { castId } = await modules.createCastForUser(modules.db, {
      userId,
      name: "Jobs Cast",
    });

    const { instanceId } = await modules.createInstance(modules.db, {
      castId,
      name: "Jobs Instance",
      mode: "gateway",
    });

    await modules.saveMailchannelsConnection(modules.db, {
      castId,
      mailchannelsAccountId: "account_jobs",
      parentApiKey: "parent_jobs_key",
    });

    await modules.provisionMailchannelsSubaccount(modules.db, {
      castId,
      instanceId,
      limit: 1000,
      suspended: false,
      persistDirectKey: false,
    });

    await modules.db
      .update(modules.mailchannelsSubaccounts)
      .set({ usageCurrentPeriod: 42 })
      .where(eq(modules.mailchannelsSubaccounts.instanceId, instanceId));

    const logger = modules.createRequestLogger("job-handler-test");

    await modules.jobHandlers["sync-usage"]({ db: modules.db, logger });

    const subaccount = await modules.db.query.mailchannelsSubaccounts.findFirst({
      where: eq(modules.mailchannelsSubaccounts.instanceId, instanceId),
    });

    expect(subaccount?.usageCurrentPeriod).toBe(0);

    await expect(
      modules.jobHandlers["validate-webhooks"]({ db: modules.db, logger }),
    ).resolves.toBeUndefined();
  });
});
