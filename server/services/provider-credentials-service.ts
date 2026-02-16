import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import {
  agentmailConnections,
  mailchannelsSubaccountKeys,
  mailchannelsSubaccounts,
} from "../../drizzle/schema.js";
import { decryptSecret } from "../lib/crypto.js";
import type { DatabaseClient } from "../lib/db.js";
import { requireMailchannelsConnection } from "./provider-connections-service.js";

export async function getInstanceProviderCredentials(
  db: DatabaseClient,
  input: { riskId: string; instanceId: string },
): Promise<{
  subaccountHandle: string;
  encryptedKey: string | null;
  parentApiKey: string;
  agentmailApiKey: string | null;
}> {
  const subaccount = await db.query.mailchannelsSubaccounts.findFirst({
    where: and(
      eq(mailchannelsSubaccounts.instanceId, input.instanceId),
      eq(mailchannelsSubaccounts.riskId, input.riskId),
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
      eq(mailchannelsSubaccountKeys.riskId, input.riskId),
      eq(mailchannelsSubaccountKeys.subaccountHandle, subaccount.handle),
      eq(mailchannelsSubaccountKeys.status, "active"),
    ),
    orderBy: [desc(mailchannelsSubaccountKeys.createdAt)],
  });

  const connection = await requireMailchannelsConnection(db, input.riskId);
  const agentmailConnection = await db.query.agentmailConnections.findFirst({
    where: eq(agentmailConnections.riskId, input.riskId),
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
