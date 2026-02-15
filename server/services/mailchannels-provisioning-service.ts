import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import {
  mailchannelsSubaccountKeys,
  mailchannelsSubaccounts,
  openclawInstances,
} from "../../drizzle/schema.js";
import { createProviderConnectors } from "../connectors/factory.js";
import { encryptSecret } from "../lib/crypto.js";
import type { DatabaseClient } from "../lib/db.js";
import { createId, toSubaccountHandle } from "../lib/id.js";
import { setInstanceStatus } from "./instance-service.js";
import { requireMailchannelsConnection } from "./provider-connections-service.js";

const connectors = createProviderConnectors();

async function requireProvisionedSubaccount(
  db: DatabaseClient,
  input: { tenantId: string; instanceId: string },
): Promise<typeof mailchannelsSubaccounts.$inferSelect> {
  const subaccount = await db.query.mailchannelsSubaccounts.findFirst({
    where: and(
      eq(mailchannelsSubaccounts.instanceId, input.instanceId),
      eq(mailchannelsSubaccounts.tenantId, input.tenantId),
    ),
  });

  if (!subaccount) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Sub-account not found." });
  }

  return subaccount;
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
  const subaccount = await requireProvisionedSubaccount(db, input);
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
  const subaccount = await requireProvisionedSubaccount(db, input);
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
  const subaccount = await requireProvisionedSubaccount(db, input);
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
  const subaccount = await requireProvisionedSubaccount(db, input);
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
  const subaccount = await requireProvisionedSubaccount(db, input);
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
  const subaccount = await requireProvisionedSubaccount(db, input);
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
