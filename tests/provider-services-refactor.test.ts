/* @vitest-environment node */

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

interface LoadedModules {
  db: (typeof import("../server/lib/db"))["db"];
  closeDatabase: (typeof import("../server/lib/db"))["closeDatabase"];
  users: (typeof import("../drizzle/schema"))["users"];
  createId: (typeof import("../server/lib/id"))["createId"];
  hashPassword: (typeof import("../server/lib/password"))["hashPassword"];
  createCastForUser: (typeof import("../server/services/cast-service"))["createCastForUser"];
  createInstance: (typeof import("../server/services/instance-service"))["createInstance"];
  saveMailchannelsConnection: (typeof import("../server/services/provider-connections-service"))["saveMailchannelsConnection"];
  saveAgentmailConnection: (typeof import("../server/services/provider-connections-service"))["saveAgentmailConnection"];
  provisionMailchannelsSubaccount: (typeof import("../server/services/mailchannels-provisioning-service"))["provisionMailchannelsSubaccount"];
  syncSubaccountUsage: (typeof import("../server/services/mailchannels-provisioning-service"))["syncSubaccountUsage"];
  validateMailchannelsWebhook: (typeof import("../server/services/mailchannels-provisioning-service"))["validateMailchannelsWebhook"];
  ensurePod: (typeof import("../server/services/agentmail-provisioning-service"))["ensurePod"];
  createAgentmailDomain: (typeof import("../server/services/agentmail-provisioning-service"))["createAgentmailDomain"];
  createAgentmailInboxForInstance: (typeof import("../server/services/agentmail-provisioning-service"))["createAgentmailInboxForInstance"];
  listDomainRecords: (typeof import("../server/services/agentmail-provisioning-service"))["listDomainRecords"];
  getInstanceProviderCredentials: (typeof import("../server/services/provider-credentials-service"))["getInstanceProviderCredentials"];
}

let modules: LoadedModules;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.CONNECTOR_MODE = "mock";
  process.env.DATABASE_URL = join(
    tmpdir(),
    `clawmail-provider-services-${Date.now()}-${randomUUID()}.db`,
  );

  const [
    dbModule,
    schemaModule,
    idModule,
    passwordModule,
    castService,
    instanceService,
    providerConnectionService,
    mailchannelsProvisioningService,
    agentmailProvisioningService,
    providerCredentialsService,
  ] = await Promise.all([
    import("../server/lib/db"),
    import("../drizzle/schema"),
    import("../server/lib/id"),
    import("../server/lib/password"),
    import("../server/services/cast-service"),
    import("../server/services/instance-service"),
    import("../server/services/provider-connections-service"),
    import("../server/services/mailchannels-provisioning-service"),
    import("../server/services/agentmail-provisioning-service"),
    import("../server/services/provider-credentials-service"),
  ]);

  modules = {
    db: dbModule.db,
    closeDatabase: dbModule.closeDatabase,
    users: schemaModule.users,
    createId: idModule.createId,
    hashPassword: passwordModule.hashPassword,
    createCastForUser: castService.createCastForUser,
    createInstance: instanceService.createInstance,
    saveMailchannelsConnection: providerConnectionService.saveMailchannelsConnection,
    saveAgentmailConnection: providerConnectionService.saveAgentmailConnection,
    provisionMailchannelsSubaccount:
      mailchannelsProvisioningService.provisionMailchannelsSubaccount,
    syncSubaccountUsage: mailchannelsProvisioningService.syncSubaccountUsage,
    validateMailchannelsWebhook: mailchannelsProvisioningService.validateMailchannelsWebhook,
    ensurePod: agentmailProvisioningService.ensurePod,
    createAgentmailDomain: agentmailProvisioningService.createAgentmailDomain,
    createAgentmailInboxForInstance:
      agentmailProvisioningService.createAgentmailInboxForInstance,
    listDomainRecords: agentmailProvisioningService.listDomainRecords,
    getInstanceProviderCredentials:
      providerCredentialsService.getInstanceProviderCredentials,
  };
});

afterAll(() => {
  modules.closeDatabase();
});

describe("provider service split", () => {
  test("supports provisioning and credential retrieval through focused services", async () => {
    const userId = modules.createId();

    await modules.db.insert(modules.users).values({
      id: userId,
      email: `owner-${userId}@example.com`,
      passwordHash: modules.hashPassword("super-secure-password"),
    });

    const { castId } = await modules.createCastForUser(modules.db, {
      userId,
      name: "Cast One",
    });

    const { instanceId } = await modules.createInstance(modules.db, {
      castId,
      name: "Outbound Worker",
      mode: "gateway",
    });

    await modules.saveMailchannelsConnection(modules.db, {
      castId,
      mailchannelsAccountId: "account_123",
      parentApiKey: "mailchannels_parent_key",
    });

    await modules.saveAgentmailConnection(modules.db, {
      castId,
      apiKey: "agentmail_api_key",
    });

    const provisioned = await modules.provisionMailchannelsSubaccount(modules.db, {
      castId,
      instanceId,
      limit: 1000,
      suspended: false,
      persistDirectKey: true,
    });

    const credentials = await modules.getInstanceProviderCredentials(modules.db, {
      castId,
      instanceId,
    });

    expect(provisioned.accountId).toBe("account_123");
    expect(credentials.subaccountHandle).toBe(provisioned.handle);
    expect(credentials.parentApiKey).toBe("mailchannels_parent_key");
    expect(credentials.agentmailApiKey).toBe("agentmail_api_key");
    expect(credentials.encryptedKey).toBeTypeOf("string");

    const pod = await modules.ensurePod(modules.db, {
      castId,
      podName: "Cast One Pod",
    });

    const createdDomain = await modules.createAgentmailDomain(modules.db, {
      castId,
      podId: pod.podId,
      domain: "example.test",
    });

    const inbox = await modules.createAgentmailInboxForInstance(modules.db, {
      castId,
      instanceId,
      username: "bot",
      domain: "example.test",
    });

    const domains = await modules.listDomainRecords(modules.db, castId);
    const usage = await modules.syncSubaccountUsage(modules.db, {
      castId,
      instanceId,
    });
    const webhookStatus = await modules.validateMailchannelsWebhook(
      modules.db,
      castId,
    );

    expect(createdDomain.domain).toBe("example.test");
    expect(domains).toHaveLength(1);
    expect(domains[0]?.dnsRecords.length).toBeGreaterThan(0);
    expect(inbox.username).toBe("bot");
    expect(inbox.domain).toBe("example.test");
    expect(usage.usage).toBe(0);
    expect(webhookStatus.ok).toBe(true);
  });
});
