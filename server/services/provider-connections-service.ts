import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import {
  agentmailConnections,
  mailchannelsConnections,
} from "../../drizzle/schema.js";
import { LiveAgentMailConnector, LiveMailChannelsConnector } from "../connectors/live.js";
import { createProviderConnectors } from "../connectors/factory.js";
import type { AgentMailConnector, MailChannelsConnector } from "../connectors/types.js";
import { decryptSecret, encryptSecret } from "../lib/crypto.js";
import type { DatabaseClient } from "../lib/db.js";
import { env } from "../lib/env.js";
import { createId } from "../lib/id.js";
import { safeJsonStringify } from "../lib/json-codec.js";
import { withProviderErrorMapping } from "./provider-error-mapper.js";

export function shouldUseLiveCredentialValidation(nodeEnv: string): boolean {
  return nodeEnv !== "test";
}

const validationConnectors = shouldUseLiveCredentialValidation(env.NODE_ENV)
  ? {
    mailchannels: new LiveMailChannelsConnector(env.MAILCHANNELS_BASE_URL),
    agentmail: new LiveAgentMailConnector(env.AGENTMAIL_BASE_URL),
  }
  : createProviderConnectors();

export async function validateMailchannelsConnectionCredentials(
  input: {
    parentApiKey: string;
  },
  connector: Pick<MailChannelsConnector, "validateCredentials"> = validationConnectors.mailchannels,
): Promise<void> {
  await withProviderErrorMapping(
    () =>
      connector.validateCredentials({
        parentApiKey: input.parentApiKey,
      }),
    "Failed to validate MailChannels credentials.",
  );
}

export async function validateAgentmailConnectionCredentials(
  input: {
    apiKey: string;
  },
  connector: Pick<AgentMailConnector, "validateCredentials"> = validationConnectors.agentmail,
): Promise<void> {
  await withProviderErrorMapping(
    () =>
      connector.validateCredentials({
        apiKey: input.apiKey,
      }),
    "Failed to validate AgentMail credentials.",
  );
}

const CREDENTIAL_PREVIEW_PREFIX_LENGTH = 6;

function buildCredentialPreview(value: string): string | null {
  const normalizedValue = value.trim();
  if (normalizedValue.length === 0) {
    return null;
  }

  const prefix = normalizedValue.slice(0, CREDENTIAL_PREVIEW_PREFIX_LENGTH);
  return `${prefix}...`;
}

export interface ProviderCredentialPreviews {
  mailchannelsAccountId: string | null;
  mailchannelsParentApiKey: string | null;
  agentmailApiKey: string | null;
}

export async function getProviderCredentialPreviews(
  db: DatabaseClient,
  castId: string,
): Promise<ProviderCredentialPreviews> {
  const [mailchannelsConnection, agentmailConnection] = await Promise.all([
    db.query.mailchannelsConnections.findFirst({
      where: eq(mailchannelsConnections.castId, castId),
    }),
    db.query.agentmailConnections.findFirst({
      where: eq(agentmailConnections.castId, castId),
    }),
  ]);

  return {
    mailchannelsAccountId: mailchannelsConnection
      ? buildCredentialPreview(mailchannelsConnection.mailchannelsAccountId)
      : null,
    mailchannelsParentApiKey: mailchannelsConnection
      ? buildCredentialPreview(
        decryptSecret(mailchannelsConnection.encryptedParentApiKey),
      )
      : null,
    agentmailApiKey: agentmailConnection
      ? buildCredentialPreview(
        decryptSecret(agentmailConnection.encryptedAgentmailApiKey),
      )
      : null,
  };
}

export async function requireMailchannelsConnection(
  db: DatabaseClient,
  castId: string,
): Promise<{ accountId: string; apiKey: string }> {
  const connection = await db.query.mailchannelsConnections.findFirst({
    where: eq(mailchannelsConnections.castId, castId),
  });

  if (!connection) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "MailChannels is not connected for this cast.",
    });
  }

  return {
    accountId: connection.mailchannelsAccountId,
    apiKey: decryptSecret(connection.encryptedParentApiKey),
  };
}

export async function requireAgentmailConnection(
  db: DatabaseClient,
  castId: string,
): Promise<{ apiKey: string; defaultPodId: string | null }> {
  const connection = await db.query.agentmailConnections.findFirst({
    where: eq(agentmailConnections.castId, castId),
  });

  if (!connection) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "AgentMail is not connected for this cast.",
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
    castId: string;
    mailchannelsAccountId?: string;
    parentApiKey?: string;
    webhookEndpointConfig?: Record<string, unknown>;
  },
): Promise<void> {
  const existing = await db.query.mailchannelsConnections.findFirst({
    where: eq(mailchannelsConnections.castId, input.castId),
  });

  const normalizedAccountId = input.mailchannelsAccountId?.trim();
  const normalizedParentApiKey = input.parentApiKey?.trim();
  const hasNewParentApiKey = Boolean(
    normalizedParentApiKey && normalizedParentApiKey.length > 0,
  );

  const nextAccountId = normalizedAccountId && normalizedAccountId.length > 0
    ? normalizedAccountId
    : existing?.mailchannelsAccountId;

  const nextParentApiKey = normalizedParentApiKey && normalizedParentApiKey.length > 0
    ? normalizedParentApiKey
    : existing
      ? decryptSecret(existing.encryptedParentApiKey)
      : null;

  if (!nextAccountId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "MailChannels account ID is required.",
    });
  }

  if (!nextParentApiKey) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "MailChannels parent API key is required.",
    });
  }

  if (!existing || hasNewParentApiKey) {
    await validateMailchannelsConnectionCredentials({
      parentApiKey: nextParentApiKey,
    });
  }

  const encryptedParentApiKey = encryptSecret(nextParentApiKey);
  const webhookEndpointConfig = input.webhookEndpointConfig === undefined
    ? existing?.webhookEndpointConfig ?? null
    : safeJsonStringify(input.webhookEndpointConfig, "{}");

  if (!existing) {
    await db.insert(mailchannelsConnections).values({
      id: createId(),
      castId: input.castId,
      mailchannelsAccountId: nextAccountId,
      encryptedParentApiKey,
      webhookEndpointConfig,
    });
    return;
  }

  await db
    .update(mailchannelsConnections)
    .set({
      mailchannelsAccountId: nextAccountId,
      encryptedParentApiKey,
      webhookEndpointConfig,
      updatedAt: Date.now(),
    })
    .where(eq(mailchannelsConnections.id, existing.id));
}

export async function saveAgentmailConnection(
  db: DatabaseClient,
  input: {
    castId: string;
    apiKey: string;
    defaultPodId?: string;
  },
): Promise<void> {
  await validateAgentmailConnectionCredentials({
    apiKey: input.apiKey,
  });

  const existing = await db.query.agentmailConnections.findFirst({
    where: eq(agentmailConnections.castId, input.castId),
  });

  if (!existing) {
    await db.insert(agentmailConnections).values({
      id: createId(),
      castId: input.castId,
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
