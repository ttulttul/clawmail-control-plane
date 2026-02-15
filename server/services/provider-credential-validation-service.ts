import { TRPCError } from "@trpc/server";

import { createProviderConnectors } from "../connectors/factory.js";
import { withProviderErrorMapping } from "./provider-error-mapper.js";

const connectors = createProviderConnectors();

function normalizeCredential(value: string): string {
  return value.trim();
}

function requireNonEmptyCredential(value: string, message: string): string {
  const normalizedValue = normalizeCredential(value);
  if (normalizedValue.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message,
    });
  }

  return normalizedValue;
}

export async function validateMailchannelsCredentialUpdate(input: {
  accountId?: string;
  parentApiKey?: string;
}): Promise<void> {
  if (input.accountId !== undefined) {
    requireNonEmptyCredential(
      input.accountId,
      "MailChannels account ID is required.",
    );
  }

  if (input.parentApiKey === undefined) {
    return;
  }

  const parentApiKey = requireNonEmptyCredential(
    input.parentApiKey,
    "MailChannels parent API key is required.",
  );

  await withProviderErrorMapping(
    () => connectors.mailchannels.listSubaccounts({ parentApiKey }),
    "Unable to validate the MailChannels parent API key.",
  );
}

export async function validateAgentmailCredential(input: {
  apiKey: string;
}): Promise<void> {
  const apiKey = requireNonEmptyCredential(
    input.apiKey,
    "AgentMail API key is required.",
  );

  await withProviderErrorMapping(
    () => connectors.agentmail.listPods({ apiKey }),
    "Unable to validate the AgentMail API key.",
  );
}
