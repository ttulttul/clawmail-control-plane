import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { agentmailInboxes, sendLog, webhookEvents } from "../../drizzle/schema.js";
import { createProviderConnectors } from "../connectors/factory.js";
import { decryptSecret, hashString } from "../lib/crypto.js";
import type { DatabaseClient } from "../lib/db.js";
import { createId } from "../lib/id.js";
import { safeJsonStringify } from "../lib/json-codec.js";
import type { RequestLogger } from "../lib/logger.js";
import { enforceSendPolicy } from "../policies/policy-engine.js";
import { getPolicyForInstance, requireInstance } from "./instance-service.js";
import { getInstanceProviderCredentials } from "./provider-credentials-service.js";

const connectors = createProviderConnectors();

export interface GatewaySendInput {
  tenantId: string;
  instanceId: string;
  from: string;
  to: string[];
  subject: string;
  textBody: string;
  htmlBody?: string;
  headers?: Record<string, string>;
}

export async function sendViaGateway(
  db: DatabaseClient,
  logger: RequestLogger,
  requestId: string,
  input: GatewaySendInput,
): Promise<{ providerRequestId: string; status: string }> {
  const instance = await requireInstance(db, {
    instanceId: input.instanceId,
    tenantId: input.tenantId,
  });

  if (instance.status !== "active") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Instance is not active and cannot send.",
    });
  }

  const policy = await getPolicyForInstance(db, input.instanceId);
  await enforceSendPolicy(db, {
    instanceId: input.instanceId,
    policy,
    message: {
      from: input.from,
      to: input.to,
      headers: input.headers ?? {},
    },
  });

  const credentials = await getInstanceProviderCredentials(db, {
    tenantId: input.tenantId,
    instanceId: input.instanceId,
  });

  const providerApiKey = credentials.encryptedKey
    ? decryptSecret(credentials.encryptedKey)
    : credentials.parentApiKey;

  const response = await connectors.mailchannels.sendEmail({
    parentOrSubaccountApiKey: providerApiKey,
    accountId: credentials.subaccountHandle,
    from: input.from,
    to: input.to,
    subject: input.subject,
    textBody: input.textBody,
    htmlBody: input.htmlBody,
    headers: input.headers,
  });

  await db.insert(sendLog).values({
    id: createId(),
    tenantId: input.tenantId,
    instanceId: input.instanceId,
    requestId,
    providerRequestId: response.requestId,
    fromEmail: input.from,
    recipientsJson: safeJsonStringify(input.to, "[]"),
    subjectHash: hashString(input.subject),
    providerStatus: response.status,
  });

  logger.info("Gateway send accepted", {
    instanceId: input.instanceId,
    providerRequestId: response.requestId,
    recipientCount: input.to.length,
  });

  return {
    providerRequestId: response.requestId,
    status: response.status,
  };
}

export async function listGatewayEvents(
  db: DatabaseClient,
  input: { tenantId: string; instanceId: string; limit: number },
): Promise<
  Array<{
    id: string;
    provider: "mailchannels" | "agentmail";
    eventType: string;
    receivedAt: number;
  }>
> {
  const rows = await db.query.webhookEvents.findMany({
    where: and(
      eq(webhookEvents.tenantId, input.tenantId),
      eq(webhookEvents.instanceId, input.instanceId),
    ),
    orderBy: [desc(webhookEvents.receivedAt)],
    limit: input.limit,
  });

  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    eventType: row.eventType,
    receivedAt: row.receivedAt,
  }));
}

export async function listInboxThreads(
  db: DatabaseClient,
  input: { tenantId: string; instanceId: string },
): Promise<Array<{ id: string; subject: string; lastMessageAt: string }>> {
  const inbox = await db.query.agentmailInboxes.findFirst({
    where: and(
      eq(agentmailInboxes.instanceId, input.instanceId),
      eq(agentmailInboxes.tenantId, input.tenantId),
    ),
  });

  if (!inbox) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No inbox provisioned for this instance.",
    });
  }

  const credentials = await getInstanceProviderCredentials(db, {
    tenantId: input.tenantId,
    instanceId: input.instanceId,
  });

  if (!credentials.agentmailApiKey) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "AgentMail is not connected for this tenant.",
    });
  }

  return connectors.agentmail.listThreads({
    apiKey: credentials.agentmailApiKey,
    inboxId: inbox.inboxId,
  });
}

export async function getInboxMessage(
  db: DatabaseClient,
  input: {
    tenantId: string;
    instanceId: string;
    messageId: string;
  },
): Promise<{ id: string; subject: string; text: string; from: string }> {
  const inbox = await db.query.agentmailInboxes.findFirst({
    where: and(
      eq(agentmailInboxes.instanceId, input.instanceId),
      eq(agentmailInboxes.tenantId, input.tenantId),
    ),
  });

  if (!inbox) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No inbox provisioned for this instance.",
    });
  }

  const credentials = await getInstanceProviderCredentials(db, {
    tenantId: input.tenantId,
    instanceId: input.instanceId,
  });

  if (!credentials.agentmailApiKey) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "AgentMail is not connected for this tenant.",
    });
  }

  return connectors.agentmail.getMessage({
    apiKey: credentials.agentmailApiKey,
    inboxId: inbox.inboxId,
    messageId: input.messageId,
  });
}

export async function replyInboxMessage(
  db: DatabaseClient,
  input: {
    tenantId: string;
    instanceId: string;
    messageId: string;
    body: string;
  },
): Promise<{ id: string }> {
  const inbox = await db.query.agentmailInboxes.findFirst({
    where: and(
      eq(agentmailInboxes.instanceId, input.instanceId),
      eq(agentmailInboxes.tenantId, input.tenantId),
    ),
  });

  if (!inbox) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No inbox provisioned for this instance.",
    });
  }

  const credentials = await getInstanceProviderCredentials(db, {
    tenantId: input.tenantId,
    instanceId: input.instanceId,
  });

  if (!credentials.agentmailApiKey) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "AgentMail is not connected for this tenant.",
    });
  }

  return connectors.agentmail.replyToMessage({
    apiKey: credentials.agentmailApiKey,
    inboxId: inbox.inboxId,
    messageId: input.messageId,
    body: input.body,
  });
}
