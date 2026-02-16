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
import { withProviderErrorMapping } from "./provider-error-mapper.js";

const connectors = createProviderConnectors();

async function requireProvisionedSubaccount(
  db: DatabaseClient,
  input: { riskId: string; instanceId: string },
): Promise<typeof mailchannelsSubaccounts.$inferSelect> {
  const subaccount = await db.query.mailchannelsSubaccounts.findFirst({
    where: and(
      eq(mailchannelsSubaccounts.instanceId, input.instanceId),
      eq(mailchannelsSubaccounts.riskId, input.riskId),
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
    riskId: string;
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
  const connection = await requireMailchannelsConnection(db, input.riskId);

  const instance = await db.query.openclawInstances.findFirst({
    where: and(
      eq(openclawInstances.id, input.instanceId),
      eq(openclawInstances.riskId, input.riskId),
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

  await withProviderErrorMapping(
    () =>
      connectors.mailchannels.createSubaccount({
        parentApiKey: connection.apiKey,
        handle,
      }),
    "Failed to create MailChannels sub-account.",
  );

  await withProviderErrorMapping(
    () =>
      connectors.mailchannels.setSubaccountLimit({
        parentApiKey: connection.apiKey,
        handle,
        limit: input.limit,
      }),
    "Failed to apply MailChannels sending limit.",
  );

  if (input.suspended) {
    await withProviderErrorMapping(
      () =>
        connectors.mailchannels.suspendSubaccount({
          parentApiKey: connection.apiKey,
          handle,
        }),
      "Failed to suspend MailChannels sub-account during provisioning.",
    );
  }

  const key = await withProviderErrorMapping(
    () =>
      connectors.mailchannels.createSubaccountApiKey({
        parentApiKey: connection.apiKey,
        handle,
      }),
    "Failed to create MailChannels API key.",
  );

  db.transaction((tx) => {
    tx
      .insert(mailchannelsSubaccounts)
      .values({
        id: createId(),
        riskId: input.riskId,
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
        riskId: input.riskId,
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
    riskId: string;
    instanceId: string;
    limit: number;
  },
): Promise<void> {
  const subaccount = await requireProvisionedSubaccount(db, input);
  const connection = await requireMailchannelsConnection(db, input.riskId);

  await withProviderErrorMapping(
    () =>
      connectors.mailchannels.setSubaccountLimit({
        parentApiKey: connection.apiKey,
        handle: subaccount.handle,
        limit: input.limit,
      }),
    "Failed to update MailChannels sending limit.",
  );

  await db
    .update(mailchannelsSubaccounts)
    .set({ limit: input.limit, updatedAt: Date.now() })
    .where(eq(mailchannelsSubaccounts.id, subaccount.id));
}

export async function deleteSubaccountLimit(
  db: DatabaseClient,
  input: {
    riskId: string;
    instanceId: string;
  },
): Promise<void> {
  const subaccount = await requireProvisionedSubaccount(db, input);
  const connection = await requireMailchannelsConnection(db, input.riskId);

  await withProviderErrorMapping(
    () =>
      connectors.mailchannels.deleteSubaccountLimit({
        parentApiKey: connection.apiKey,
        handle: subaccount.handle,
      }),
    "Failed to delete MailChannels sending limit.",
  );

  await db
    .update(mailchannelsSubaccounts)
    .set({ limit: -1, updatedAt: Date.now() })
    .where(eq(mailchannelsSubaccounts.id, subaccount.id));
}

export async function suspendSubaccount(
  db: DatabaseClient,
  input: {
    riskId: string;
    instanceId: string;
  },
): Promise<void> {
  const subaccount = await requireProvisionedSubaccount(db, input);
  const connection = await requireMailchannelsConnection(db, input.riskId);

  await withProviderErrorMapping(
    () =>
      connectors.mailchannels.suspendSubaccount({
        parentApiKey: connection.apiKey,
        handle: subaccount.handle,
      }),
    "Failed to suspend MailChannels sub-account.",
  );

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
    riskId: string;
    instanceId: string;
  },
): Promise<void> {
  const subaccount = await requireProvisionedSubaccount(db, input);
  const connection = await requireMailchannelsConnection(db, input.riskId);

  await withProviderErrorMapping(
    () =>
      connectors.mailchannels.activateSubaccount({
        parentApiKey: connection.apiKey,
        handle: subaccount.handle,
      }),
    "Failed to activate MailChannels sub-account.",
  );

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
    riskId: string;
    instanceId: string;
    persistDirectKey: boolean;
  },
): Promise<{ keyValue: string; redactedValue: string }> {
  const subaccount = await requireProvisionedSubaccount(db, input);
  const connection = await requireMailchannelsConnection(db, input.riskId);

  const currentKeys = await db.query.mailchannelsSubaccountKeys.findMany({
    where: and(
      eq(mailchannelsSubaccountKeys.riskId, input.riskId),
      eq(mailchannelsSubaccountKeys.subaccountHandle, subaccount.handle),
    ),
    orderBy: [desc(mailchannelsSubaccountKeys.createdAt)],
  });

  if (currentKeys.length >= 2) {
    const retiringKey = currentKeys[currentKeys.length - 1];
    await withProviderErrorMapping(
      () =>
        connectors.mailchannels.deleteSubaccountApiKey({
          parentApiKey: connection.apiKey,
          handle: subaccount.handle,
          providerKeyId: retiringKey.providerKeyId,
        }),
      "Failed to retire existing MailChannels API key.",
    );

    await db
      .update(mailchannelsSubaccountKeys)
      .set({ status: "revoked", updatedAt: Date.now() })
      .where(eq(mailchannelsSubaccountKeys.id, retiringKey.id));
  }

  const key = await withProviderErrorMapping(
    () =>
      connectors.mailchannels.createSubaccountApiKey({
        parentApiKey: connection.apiKey,
        handle: subaccount.handle,
      }),
    "Failed to rotate MailChannels API key.",
  );

  db.transaction((tx) => {
    tx
      .update(mailchannelsSubaccountKeys)
      .set({ status: "retiring", updatedAt: Date.now() })
      .where(
        and(
          eq(mailchannelsSubaccountKeys.riskId, input.riskId),
          eq(mailchannelsSubaccountKeys.subaccountHandle, subaccount.handle),
          eq(mailchannelsSubaccountKeys.status, "active"),
        ),
      )
      .run();

    tx
      .insert(mailchannelsSubaccountKeys)
      .values({
        id: createId(),
        riskId: input.riskId,
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
    riskId: string;
    instanceId: string;
  },
): Promise<{ usage: number }> {
  const subaccount = await requireProvisionedSubaccount(db, input);
  const connection = await requireMailchannelsConnection(db, input.riskId);

  const usage = await withProviderErrorMapping(
    () =>
      connectors.mailchannels.retrieveSubaccountUsage({
        parentApiKey: connection.apiKey,
        handle: subaccount.handle,
      }),
    "Failed to retrieve MailChannels usage.",
  );

  await db
    .update(mailchannelsSubaccounts)
    .set({ usageCurrentPeriod: usage.usage, updatedAt: Date.now() })
    .where(eq(mailchannelsSubaccounts.id, subaccount.id));

  return usage;
}

export async function validateMailchannelsWebhook(
  db: DatabaseClient,
  riskId: string,
): Promise<{ ok: boolean; message: string }> {
  const connection = await requireMailchannelsConnection(db, riskId);
  return withProviderErrorMapping(
    () =>
      connectors.mailchannels.validateWebhook({
        parentApiKey: connection.apiKey,
      }),
    "Failed to validate MailChannels webhook configuration.",
  );
}
