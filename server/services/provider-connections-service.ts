import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import {
  agentmailConnections,
  mailchannelsConnections,
} from "../../drizzle/schema.js";
import { decryptSecret, encryptSecret } from "../lib/crypto.js";
import type { DatabaseClient } from "../lib/db.js";
import { createId } from "../lib/id.js";
import { safeJsonStringify } from "../lib/json-codec.js";

export async function requireMailchannelsConnection(
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

export async function requireAgentmailConnection(
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
    ? safeJsonStringify(input.webhookEndpointConfig, "{}")
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
