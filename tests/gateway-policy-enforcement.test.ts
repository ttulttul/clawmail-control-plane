/* @vitest-environment node */

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

interface LoadedModules {
  db: (typeof import("../server/lib/db"))["db"];
  closeDatabase: (typeof import("../server/lib/db"))["closeDatabase"];
  createRequestLogger: (typeof import("../server/lib/logger"))["createRequestLogger"];
  createId: (typeof import("../server/lib/id"))["createId"];
  hashPassword: (typeof import("../server/lib/password"))["hashPassword"];
  users: (typeof import("../drizzle/schema"))["users"];
  sendLog: (typeof import("../drizzle/schema"))["sendLog"];
  createTenantForUser: (typeof import("../server/services/tenant-service"))["createTenantForUser"];
  createInstance: (typeof import("../server/services/instance-service"))["createInstance"];
  setInstancePolicy: (typeof import("../server/services/instance-service"))["setInstancePolicy"];
  saveMailchannelsConnection: (typeof import("../server/services/provider-connections-service"))["saveMailchannelsConnection"];
  provisionMailchannelsSubaccount: (typeof import("../server/services/mailchannels-provisioning-service"))["provisionMailchannelsSubaccount"];
  sendViaGateway: (typeof import("../server/services/gateway-service"))["sendViaGateway"];
}

let modules: LoadedModules;
let tenantId = "";

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.CONNECTOR_MODE = "mock";
  process.env.DATABASE_URL = join(
    tmpdir(),
    `clawmail-policy-tests-${Date.now()}-${randomUUID()}.db`,
  );

  const [
    dbModule,
    loggerModule,
    idModule,
    passwordModule,
    schemaModule,
    tenantService,
    instanceService,
    providerConnectionService,
    mailchannelsService,
    gatewayService,
  ] = await Promise.all([
    import("../server/lib/db"),
    import("../server/lib/logger"),
    import("../server/lib/id"),
    import("../server/lib/password"),
    import("../drizzle/schema"),
    import("../server/services/tenant-service"),
    import("../server/services/instance-service"),
    import("../server/services/provider-connections-service"),
    import("../server/services/mailchannels-provisioning-service"),
    import("../server/services/gateway-service"),
  ]);

  modules = {
    db: dbModule.db,
    closeDatabase: dbModule.closeDatabase,
    createRequestLogger: loggerModule.createRequestLogger,
    createId: idModule.createId,
    hashPassword: passwordModule.hashPassword,
    users: schemaModule.users,
    sendLog: schemaModule.sendLog,
    createTenantForUser: tenantService.createTenantForUser,
    createInstance: instanceService.createInstance,
    setInstancePolicy: instanceService.setInstancePolicy,
    saveMailchannelsConnection: providerConnectionService.saveMailchannelsConnection,
    provisionMailchannelsSubaccount:
      mailchannelsService.provisionMailchannelsSubaccount,
    sendViaGateway: gatewayService.sendViaGateway,
  };

  const userId = modules.createId();
  await modules.db.insert(modules.users).values({
    id: userId,
    email: `policy-${userId}@example.com`,
    passwordHash: modules.hashPassword("super-secure-password"),
  });

  const tenant = await modules.createTenantForUser(modules.db, {
    userId,
    name: "Policy Tenant",
  });
  tenantId = tenant.tenantId;

  await modules.saveMailchannelsConnection(modules.db, {
    tenantId,
    mailchannelsAccountId: "policy-account",
    parentApiKey: "policy-parent-key",
  });
});

afterAll(() => {
  modules.closeDatabase();
});

async function createProvisionedInstance(
  policy: {
    maxRecipientsPerMessage: number;
    perMinuteLimit: number;
    dailyCap: number;
    requiredHeaders: string[];
    allowList: string[];
    denyList: string[];
  },
): Promise<string> {
  const instance = await modules.createInstance(modules.db, {
    tenantId,
    name: `instance-${randomUUID().slice(0, 6)}`,
    mode: "gateway",
  });

  await modules.provisionMailchannelsSubaccount(modules.db, {
    tenantId,
    instanceId: instance.instanceId,
    limit: 1000,
    suspended: false,
    persistDirectKey: false,
  });

  await modules.setInstancePolicy(modules.db, {
    instanceId: instance.instanceId,
    policy,
  });

  return instance.instanceId;
}

function sendInput(instanceId: string, to: string[], headers: Record<string, string>) {
  return {
    tenantId,
    instanceId,
    from: "sender@example.com",
    to,
    subject: "Policy check",
    textBody: "Body",
    headers,
  };
}

describe("gateway policy enforcement", () => {
  test("rejects sends when required headers are missing", async () => {
    const instanceId = await createProvisionedInstance({
      maxRecipientsPerMessage: 10,
      perMinuteLimit: 10,
      dailyCap: 100,
      requiredHeaders: ["X-Trace-Id"],
      allowList: [],
      denyList: [],
    });

    await expect(
      modules.sendViaGateway(
        modules.db,
        modules.createRequestLogger("required-headers"),
        randomUUID(),
        sendInput(instanceId, ["user@example.com"], {}),
      ),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Missing required header: X-Trace-Id",
    });
  });

  test("enforces per-minute send limits", async () => {
    const instanceId = await createProvisionedInstance({
      maxRecipientsPerMessage: 10,
      perMinuteLimit: 1,
      dailyCap: 100,
      requiredHeaders: [],
      allowList: [],
      denyList: [],
    });

    await expect(
      modules.sendViaGateway(
        modules.db,
        modules.createRequestLogger("per-minute-ok"),
        randomUUID(),
        sendInput(instanceId, ["user@example.com"], {}),
      ),
    ).resolves.toMatchObject({ status: "queued" });

    await expect(
      modules.sendViaGateway(
        modules.db,
        modules.createRequestLogger("per-minute-blocked"),
        randomUUID(),
        sendInput(instanceId, ["user@example.com"], {}),
      ),
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "Per-minute sending limit exceeded for this instance.",
    });
  });

  test("enforces daily cap", async () => {
    const instanceId = await createProvisionedInstance({
      maxRecipientsPerMessage: 10,
      perMinuteLimit: 100,
      dailyCap: 1,
      requiredHeaders: [],
      allowList: [],
      denyList: [],
    });

    await modules.db.insert(modules.sendLog).values({
      id: modules.createId(),
      tenantId,
      instanceId,
      requestId: randomUUID(),
      providerRequestId: randomUUID(),
      fromEmail: "sender@example.com",
      recipientsJson: "[]",
      subjectHash: "existing-subject-hash",
      providerStatus: "queued",
      createdAt: Date.now(),
    });

    await expect(
      modules.sendViaGateway(
        modules.db,
        modules.createRequestLogger("daily-cap"),
        randomUUID(),
        sendInput(instanceId, ["user@example.com"], {}),
      ),
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "Daily cap exceeded for this instance.",
    });
  });

  test("applies allow and deny domain matching", async () => {
    const allowListInstanceId = await createProvisionedInstance({
      maxRecipientsPerMessage: 10,
      perMinuteLimit: 100,
      dailyCap: 100,
      requiredHeaders: [],
      allowList: ["allowed.example"],
      denyList: [],
    });

    await expect(
      modules.sendViaGateway(
        modules.db,
        modules.createRequestLogger("allow-list"),
        randomUUID(),
        sendInput(allowListInstanceId, ["user@blocked.example"], {}),
      ),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "At least one recipient is not in the allow list.",
    });

    const denyListInstanceId = await createProvisionedInstance({
      maxRecipientsPerMessage: 10,
      perMinuteLimit: 100,
      dailyCap: 100,
      requiredHeaders: [],
      allowList: [],
      denyList: ["blocked.example"],
    });

    await expect(
      modules.sendViaGateway(
        modules.db,
        modules.createRequestLogger("deny-list"),
        randomUUID(),
        sendInput(denyListInstanceId, ["user@sub.blocked.example"], {}),
      ),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Recipient domain sub.blocked.example is blocked by deny list policy.",
    });
  });
});
