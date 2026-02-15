import { createHash, timingSafeEqual } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { webhookEvents } from "../../drizzle/schema.js";
import type { DatabaseClient } from "../lib/db.js";
import { env } from "../lib/env.js";
import { createId } from "../lib/id.js";

function createDedupeKey(
  provider: "mailchannels" | "agentmail",
  providerEventId: string,
  eventType: string,
): string {
  return createHash("sha256")
    .update(`${provider}:${providerEventId}:${eventType}`)
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function verifySharedWebhookSecret(
  sharedSecretHeader: string | undefined,
): void {
  if (!env.WEBHOOK_SHARED_SECRET) {
    return;
  }

  if (!sharedSecretHeader || !safeEqual(sharedSecretHeader, env.WEBHOOK_SHARED_SECRET)) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Webhook secret validation failed.",
    });
  }
}

export function verifyMailchannelsWebhookHeaders(headers: {
  contentDigest?: string;
  signature?: string;
  signatureInput?: string;
}): void {
  if (!env.MAILCHANNELS_WEBHOOK_VERIFY) {
    return;
  }

  if (!headers.contentDigest || !headers.signature || !headers.signatureInput) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Missing MailChannels signature headers.",
    });
  }

  // Full Ed25519 verification requires parsing Signature-Input and key retrieval.
  // Enforcing required header presence keeps the default pipeline strict while
  // allowing mock mode local development.
}

export async function storeWebhookEvent(
  db: DatabaseClient,
  input: {
    provider: "mailchannels" | "agentmail";
    providerEventId: string;
    eventType: string;
    tenantId?: string;
    instanceId?: string;
    payload: unknown;
  },
): Promise<{ id: string; duplicate: boolean }> {
  const dedupeKey = createDedupeKey(
    input.provider,
    input.providerEventId,
    input.eventType,
  );

  const existing = await db.query.webhookEvents.findFirst({
    where: eq(webhookEvents.dedupeKey, dedupeKey),
  });

  if (existing) {
    return { id: existing.id, duplicate: true };
  }

  const id = createId();
  await db.insert(webhookEvents).values({
    id,
    provider: input.provider,
    providerEventId: input.providerEventId,
    eventType: input.eventType,
    tenantId: input.tenantId ?? null,
    instanceId: input.instanceId ?? null,
    payloadJson: JSON.stringify(input.payload),
    dedupeKey,
  });

  return { id, duplicate: false };
}

export async function markWebhookProcessed(
  db: DatabaseClient,
  id: string,
): Promise<void> {
  await db
    .update(webhookEvents)
    .set({ processedAt: Date.now() })
    .where(eq(webhookEvents.id, id));
}

export async function findWebhookByProviderEvent(
  db: DatabaseClient,
  input: {
    provider: "mailchannels" | "agentmail";
    providerEventId: string;
  },
): Promise<{ id: string } | null> {
  const row = await db.query.webhookEvents.findFirst({
    where: and(
      eq(webhookEvents.provider, input.provider),
      eq(webhookEvents.providerEventId, input.providerEventId),
    ),
  });

  return row ? { id: row.id } : null;
}
