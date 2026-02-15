import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import {
  agentmailConnections,
  agentmailDomains,
  agentmailInboxes,
  agentmailPods,
  mailchannelsConnections,
  mailchannelsSubaccountKeys,
  mailchannelsSubaccounts,
  openclawInstances,
} from "../../drizzle/schema.js";
import { createProviderConnectors } from "../connectors/factory.js";
import type { DatabaseClient } from "../lib/db.js";
import { decryptSecret, encryptSecret } from "../lib/crypto.js";
import { createId, toSubaccountHandle } from "../lib/id.js";
import { setInstanceStatus } from "./instance-service.js";

const connectors = createProviderConnectors();

function parseStringList(rawValue: string): string[] {
  const parsed: unknown = JSON.parse(rawValue);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter((value): value is string => typeof value === "string");
}

async function requireMailchannelsConnection(
  db: DatabaseClient,
  tenantId: string,
): Promise<{ accountId: string; apiKey: string }> {
  const connection = await db.query.mailchannelsConnections.findFirst({
    where: eq(mailchannelsConnections.tenantId, tenantId),
  });

  if (!connection) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "MailChannels is not connected for this tenant.",
    });
  }

  return {
    accountId: connection.mailchannelsAccountId,
    apiKey: decryptSecret(connection.encryptedParentApiKey),
  };
}

async function requireAgentmailConnection(
  db: DatabaseClient,
  tenantId: string,
): Promise<{ apiKey: string; defaultPodId: string | null }> {
  const connection = await db.query.agentmailConnections.findFirst({
    where: eq(agentmailConnections.tenantId, tenantId),
  });

  if (!connection) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "AgentMail is not connected for this tenant.",
    });
  }

  return {
    apiKey: decryptSecret(connection.encryptedAgentmailApiKey),
    defaultPodId: connection.defaultPodId,
  };
}

export async function saveMailchannelsConnection(
  db: DatabaseClient,
  input: {
    tenantId: string;
    mailchannelsAccountId: string;
    parentApiKey: string;
    webhookEndpointConfig?: Record<string, unknown>;
  },
): Promise<void> {
  const existing = await db.query.mailchannelsConnections.findFirst({
    where: eq(mailchannelsConnections.tenantId, input.tenantId),
  });

  const encryptedParentApiKey = encryptSecret(input.parentApiKey);
  const webhookEndpointConfig = input.webhookEndpointConfig
    ? JSON.stringify(input.webhookEndpointConfig)
    : null;

  if (!existing) {
    await db.insert(mailchannelsConnections).values({
      id: createId(),
      tenantId: input.tenantId,
      mailchannelsAccountId: input.mailchannelsAccountId,
      encryptedParentApiKey,
      webhookEndpointConfig,
    });
    return;
  }

  await db
    .update(mailchannelsConnections)
    .set({
      mailchannelsAccountId: input.mailchannelsAccountId,
      encryptedParentApiKey,
      webhookEndpointConfig,
      updatedAt: Date.now(),
    })
    .where(eq(mailchannelsConnections.id, existing.id));
}

export async function saveAgentmailConnection(
  db: DatabaseClient,
  input: {
    tenantId: string;
    apiKey: string;
    defaultPodId?: string;
  },
): Promise<void> {
  const existing = await db.query.agentmailConnections.findFirst({
    where: eq(agentmailConnections.tenantId, input.tenantId),
  });

  if (!existing) {
    await db.insert(agentmailConnections).values({
      id: createId(),
      tenantId: input.tenantId,
      encryptedAgentmailApiKey: encryptSecret(input.apiKey),
      defaultPodId: input.defaultPodId ?? null,
    });
    return;
  }

  await db
    .update(agentmailConnections)
    .set({
      encryptedAgentmailApiKey: encryptSecret(input.apiKey),
      defaultPodId: input.defaultPodId ?? existing.defaultPodId,
      updatedAt: Date.now(),
    })
    .where(eq(agentmailConnections.id, existing.id));
}

export async function ensurePod(
  db: DatabaseClient,
  input: { tenantId: string; podName: string },
): Promise<{ podId: string }> {
  const existing = await db.query.agentmailPods.findFirst({
    where: eq(agentmailPods.tenantId, input.tenantId),
  });

  if (existing) {
    return { podId: existing.podId };
  }

  const connection = await requireAgentmailConnection(db, input.tenantId);
  const pod = await connectors.agentmail.ensurePod({
    apiKey: connection.apiKey,
    name: input.podName,
  });

  await db.insert(agentmailPods).values({
    id: createId(),
    tenantId: input.tenantId,
    podId: pod.podId,
  });

  await db
    .update(agentmailConnections)
    .set({ defaultPodId: pod.podId, updatedAt: Date.now() })
    .where(eq(agentmailConnections.tenantId, input.tenantId));

  return { podId: pod.podId };
}

export async function createAgentmailDomain(
  db: DatabaseClient,
  input: { tenantId: string; podId: string; domain: string },
): Promise<{ domain: string; status: string; dnsRecords: string[] }> {
  const connection = await requireAgentmailConnection(db, input.tenantId);
  const created = await connectors.agentmail.createDomain({
    apiKey: connection.apiKey,
    podId: input.podId,
    domain: input.domain,
  });

  await db.insert(agentmailDomains).values({
    id: createId(),
    tenantId: input.tenantId,
    podId: input.podId,
    domain: created.domain,
    status: created.status,
    dnsRecordsJson: JSON.stringify(created.dnsRecords),
  });

  return created;
}

export async function createAgentmailInboxForInstance(
  db: DatabaseClient,
  input: {
    tenantId: string;
    instanceId: string;
    username: string;
    domain?: string;
  },
): Promise<{ inboxId: string; username: string; domain: string }> {
  const instance = await db.query.openclawInstances.findFirst({
    where: and(
      eq(openclawInstances.id, input.instanceId),
      eq(openclawInstances.tenantId, input.tenantId),
    ),
  });

  if (!instance) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Instance not found." });
  }

  const existing = await db.query.agentmailInboxes.findFirst({
    where: eq(agentmailInboxes.instanceId, input.instanceId),
  });
  if (existing) {
    return {
      inboxId: existing.inboxId,
      username: existing.username,
      domain: existing.domain,
    };
  }

  const connection = await requireAgentmailConnection(db, input.tenantId);
  const podId = connection.defaultPodId ?? (await ensurePod(db, {
    tenantId: input.tenantId,
    podName: `${instance.name}-pod`,
  })).podId;

  const created = await connectors.agentmail.createInbox({
    apiKey: connection.apiKey,
    podId,
    username: input.username,
    domain: input.domain,
  });

  await db.insert(agentmailInboxes).values({
    id: createId(),
    tenantId: input.tenantId,
    instanceId: input.instanceId,
    podId,
    inboxId: created.inboxId,
    username: created.username,
    domain: created.domain,
  });

  return created;
}

export async function provisionMailchannelsSubaccount(
  db: DatabaseClient,
  input: {
    tenantId: string;
    instanceId: string;
    limit: number;
    suspended: boolean;
    persistDirectKey: boolean;
  },
): Promise<{
  handle: string;
  keyValue: string;
  redactedValue: string;
  providerKeyId: string;
  accountId: string;
}> {
  const connection = await requireMailchannelsConnection(db, input.tenantId);

  const instance = await db.query.openclawInstances.findFirst({
    where: and(
      eq(openclawInstances.id, input.instanceId),
      eq(openclawInstances.tenantId, input.tenantId),
    ),
  });

  if (!instance) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Instance not found.",
    });
  }

  const existing = await db.query.mailchannelsSubaccounts.findFirst({
    where: eq(mailchannelsSubaccounts.instanceId, input.instanceId),
  });

  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Instance already has a MailChannels sub-account.",
    });
  }

  const handle = toSubaccountHandle(`${instance.name}${instance.id.slice(0, 6)}`);

  await connectors.mailchannels.createSubaccount({
    parentApiKey: connection.apiKey,
    handle,
  });

  await connectors.mailchannels.setSubaccountLimit({
    parentApiKey: connection.apiKey,
    handle,
    limit: input.limit,
  });

  if (input.suspended) {
    await connectors.mailchannels.suspendSubaccount({
      parentApiKey: connection.apiKey,
      handle,
    });
  }

  const key = await connectors.mailchannels.createSubaccountApiKey({
    parentApiKey: connection.apiKey,
    handle,
  });

  db.transaction((tx) => {
    tx
      .insert(mailchannelsSubaccounts)
      .values({
        id: createId(),
        tenantId: input.tenantId,
        instanceId: input.instanceId,
        handle,
        enabled: !input.suspended,
        limit: input.limit,
      })
      .run();

    tx
      .insert(mailchannelsSubaccountKeys)
      .values({
        id: createId(),
        tenantId: input.tenantId,
        subaccountHandle: handle,
        providerKeyId: key.providerKeyId,
        redactedValue: key.redactedValue,
        encryptedValue: input.persistDirectKey ? encryptSecret(key.keyValue) : null,
        status: "active",
      })
      .run();
  });

  if (input.suspended) {
    await setInstanceStatus(db, { instanceId: input.instanceId, status: "suspended" });
  }

  return {
    handle,
    keyValue: key.keyValue,
    redactedValue: key.redactedValue,
    providerKeyId: key.providerKeyId,
    accountId: connection.accountId,
  };
}

export async function setSubaccountLimit(
  db: DatabaseClient,
  input: {
    tenantId: string;
    instanceId: string;
    limit: number;
  },
): Promise<void> {
  const subaccount = await db.query.mailchannelsSubaccounts.findFirst({
    where: and(
      eq(mailchannelsSubaccounts.instanceId, input.instanceId),
      eq(mailchannelsSubaccounts.tenantId, input.tenantId),
    ),
  });
  if (!subaccount) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Sub-account not found." });
  }

  const connection = await requireMailchannelsConnection(db, input.tenantId);
  await connectors.mailchannels.setSubaccountLimit({
    parentApiKey: connection.apiKey,
    handle: subaccount.handle,
    limit: input.limit,
  });

  await db
    .update(mailchannelsSubaccounts)
    .set({ limit: input.limit, updatedAt: Date.now() })
    .where(eq(mailchannelsSubaccounts.id, subaccount.id));
}

export async function deleteSubaccountLimit(
  db: DatabaseClient,
  input: {
    tenantId: string;
    instanceId: string;
  },
): Promise<void> {
  const subaccount = await db.query.mailchannelsSubaccounts.findFirst({
    where: and(
      eq(mailchannelsSubaccounts.instanceId, input.instanceId),
      eq(mailchannelsSubaccounts.tenantId, input.tenantId),
    ),
  });

  if (!subaccount) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Sub-account not found." });
  }

  const connection = await requireMailchannelsConnection(db, input.tenantId);
  await connectors.mailchannels.deleteSubaccountLimit({
    parentApiKey: connection.apiKey,
    handle: subaccount.handle,
  });

  await db
    .update(mailchannelsSubaccounts)
    .set({ limit: -1, updatedAt: Date.now() })
    .where(eq(mailchannelsSubaccounts.id, subaccount.id));
}

export async function suspendSubaccount(
  db: DatabaseClient,
  input: {
    tenantId: string;
    instanceId: string;
  },
): Promise<void> {
  const subaccount = await db.query.mailchannelsSubaccounts.findFirst({
    where: and(
      eq(mailchannelsSubaccounts.instanceId, input.instanceId),
      eq(mailchannelsSubaccounts.tenantId, input.tenantId),
    ),
  });

  if (!subaccount) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Sub-account not found." });
  }

  const connection = await requireMailchannelsConnection(db, input.tenantId);
  await connectors.mailchannels.suspendSubaccount({
    parentApiKey: connection.apiKey,
    handle: subaccount.handle,
  });

  db.transaction((tx) => {
    tx
      .update(mailchannelsSubaccounts)
      .set({ enabled: false, updatedAt: Date.now() })
      .where(eq(mailchannelsSubaccounts.id, subaccount.id))
      .run();

    tx
      .update(openclawInstances)
      .set({ status: "suspended", updatedAt: Date.now() })
      .where(eq(openclawInstances.id, input.instanceId))
      .run();
  });
}

export async function activateSubaccount(
  db: DatabaseClient,
  input: {
    tenantId: string;
    instanceId: string;
  },
): Promise<void> {
  const subaccount = await db.query.mailchannelsSubaccounts.findFirst({
    where: and(
      eq(mailchannelsSubaccounts.instanceId, input.instanceId),
      eq(mailchannelsSubaccounts.tenantId, input.tenantId),
    ),
  });

  if (!subaccount) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Sub-account not found." });
  }

  const connection = await requireMailchannelsConnection(db, input.tenantId);
  await connectors.mailchannels.activateSubaccount({
    parentApiKey: connection.apiKey,
    handle: subaccount.handle,
  });

  db.transaction((tx) => {
    tx
      .update(mailchannelsSubaccounts)
      .set({ enabled: true, updatedAt: Date.now() })
      .where(eq(mailchannelsSubaccounts.id, subaccount.id))
      .run();

    tx
      .update(openclawInstances)
      .set({ status: "active", updatedAt: Date.now() })
      .where(eq(openclawInstances.id, input.instanceId))
      .run();
  });
}

export async function rotateSubaccountKey(
  db: DatabaseClient,
  input: {
    tenantId: string;
    instanceId: string;
    persistDirectKey: boolean;
  },
): Promise<{ keyValue: string; redactedValue: string }> {
  const subaccount = await db.query.mailchannelsSubaccounts.findFirst({
    where: and(
      eq(mailchannelsSubaccounts.instanceId, input.instanceId),
      eq(mailchannelsSubaccounts.tenantId, input.tenantId),
    ),
  });

  if (!subaccount) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Sub-account not found." });
  }

  const connection = await requireMailchannelsConnection(db, input.tenantId);

  const currentKeys = await db.query.mailchannelsSubaccountKeys.findMany({
    where: and(
      eq(mailchannelsSubaccountKeys.tenantId, input.tenantId),
      eq(mailchannelsSubaccountKeys.subaccountHandle, subaccount.handle),
    ),
    orderBy: [desc(mailchannelsSubaccountKeys.createdAt)],
  });

  if (currentKeys.length >= 2) {
    const retiringKey = currentKeys[currentKeys.length - 1];
    await connectors.mailchannels.deleteSubaccountApiKey({
      parentApiKey: connection.apiKey,
      handle: subaccount.handle,
      providerKeyId: retiringKey.providerKeyId,
    });

    await db
      .update(mailchannelsSubaccountKeys)
      .set({ status: "revoked", updatedAt: Date.now() })
      .where(eq(mailchannelsSubaccountKeys.id, retiringKey.id));
  }

  const key = await connectors.mailchannels.createSubaccountApiKey({
    parentApiKey: connection.apiKey,
    handle: subaccount.handle,
  });

  db.transaction((tx) => {
    tx
      .update(mailchannelsSubaccountKeys)
      .set({ status: "retiring", updatedAt: Date.now() })
      .where(
        and(
          eq(mailchannelsSubaccountKeys.tenantId, input.tenantId),
          eq(mailchannelsSubaccountKeys.subaccountHandle, subaccount.handle),
          eq(mailchannelsSubaccountKeys.status, "active"),
        ),
      )
      .run();

    tx
      .insert(mailchannelsSubaccountKeys)
      .values({
        id: createId(),
        tenantId: input.tenantId,
        subaccountHandle: subaccount.handle,
        providerKeyId: key.providerKeyId,
        redactedValue: key.redactedValue,
        encryptedValue: input.persistDirectKey ? encryptSecret(key.keyValue) : null,
        status: "active",
      })
      .run();
  });

  return {
    keyValue: key.keyValue,
    redactedValue: key.redactedValue,
  };
}

export async function syncSubaccountUsage(
  db: DatabaseClient,
  input: {
    tenantId: string;
    instanceId: string;
  },
): Promise<{ usage: number }> {
  const subaccount = await db.query.mailchannelsSubaccounts.findFirst({
    where: and(
      eq(mailchannelsSubaccounts.instanceId, input.instanceId),
      eq(mailchannelsSubaccounts.tenantId, input.tenantId),
    ),
  });

  if (!subaccount) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Sub-account not found." });
  }

  const connection = await requireMailchannelsConnection(db, input.tenantId);
  const usage = await connectors.mailchannels.retrieveSubaccountUsage({
    parentApiKey: connection.apiKey,
    handle: subaccount.handle,
  });

  await db
    .update(mailchannelsSubaccounts)
    .set({ usageCurrentPeriod: usage.usage, updatedAt: Date.now() })
    .where(eq(mailchannelsSubaccounts.id, subaccount.id));

  return usage;
}

export async function validateMailchannelsWebhook(
  db: DatabaseClient,
  tenantId: string,
): Promise<{ ok: boolean; message: string }> {
  const connection = await requireMailchannelsConnection(db, tenantId);
  return connectors.mailchannels.validateWebhook({
    parentApiKey: connection.apiKey,
  });
}

export async function getInstanceProviderCredentials(
  db: DatabaseClient,
  input: { tenantId: string; instanceId: string },
): Promise<{
  subaccountHandle: string;
  encryptedKey: string | null;
  parentApiKey: string;
  agentmailApiKey: string | null;
}> {
  const subaccount = await db.query.mailchannelsSubaccounts.findFirst({
    where: and(
      eq(mailchannelsSubaccounts.instanceId, input.instanceId),
      eq(mailchannelsSubaccounts.tenantId, input.tenantId),
    ),
  });

  if (!subaccount) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "MailChannels sub-account not provisioned.",
    });
  }

  const activeKey = await db.query.mailchannelsSubaccountKeys.findFirst({
    where: and(
      eq(mailchannelsSubaccountKeys.tenantId, input.tenantId),
      eq(mailchannelsSubaccountKeys.subaccountHandle, subaccount.handle),
      eq(mailchannelsSubaccountKeys.status, "active"),
    ),
    orderBy: [desc(mailchannelsSubaccountKeys.createdAt)],
  });

  const connection = await requireMailchannelsConnection(db, input.tenantId);
  const agentmailConnection = await db.query.agentmailConnections.findFirst({
    where: eq(agentmailConnections.tenantId, input.tenantId),
  });

  return {
    subaccountHandle: subaccount.handle,
    encryptedKey: activeKey?.encryptedValue ?? null,
    parentApiKey: connection.apiKey,
    agentmailApiKey: agentmailConnection
      ? decryptSecret(agentmailConnection.encryptedAgentmailApiKey)
      : null,
  };
}

export async function listDomainRecords(
  db: DatabaseClient,
  tenantId: string,
): Promise<
  Array<{
    id: string;
    podId: string;
    domain: string;
    status: string;
    dnsRecords: string[];
  }>
> {
  const rows = await db.query.agentmailDomains.findMany({
    where: eq(agentmailDomains.tenantId, tenantId),
    orderBy: [desc(agentmailDomains.createdAt)],
  });

  return rows.map((row) => ({
    id: row.id,
    podId: row.podId,
    domain: row.domain,
    status: row.status,
    dnsRecords: parseStringList(row.dnsRecordsJson),
  }));
}
