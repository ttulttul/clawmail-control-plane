import { and, eq, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { rateLimitBuckets, sendLog } from "../../drizzle/schema.js";
import type { DatabaseClient } from "../lib/db.js";
import { createId } from "../lib/id.js";
import type { LoadedPolicy } from "../services/instance-service.js";

export interface SendPolicyInput {
  from: string;
  to: string[];
  headers: Record<string, string>;
}

function recipientDomain(address: string): string {
  const [, domain] = address.split("@");
  return (domain ?? "").toLowerCase();
}

function normalizeHeaderKey(headerName: string): string {
  return headerName.toLowerCase();
}

function includesDomainMatch(patterns: string[], domain: string): boolean {
  return patterns.some((pattern) => {
    const normalizedPattern = pattern.toLowerCase();
    return domain === normalizedPattern || domain.endsWith(`.${normalizedPattern}`);
  });
}

async function checkDailyCap(
  db: DatabaseClient,
  input: { instanceId: string; policy: LoadedPolicy },
): Promise<void> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(sendLog)
    .where(
      and(
        eq(sendLog.instanceId, input.instanceId),
        gte(sendLog.createdAt, startOfDay.getTime()),
      ),
    );

  const sentToday = rows[0]?.count ?? 0;
  if (sentToday >= input.policy.dailyCap) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Daily cap exceeded for this instance.",
    });
  }
}

async function consumePerMinuteLimit(
  db: DatabaseClient,
  input: { instanceId: string; perMinuteLimit: number },
): Promise<void> {
  const windowKey = `${Math.floor(Date.now() / 60000)}`;

  const bucket = await db.query.rateLimitBuckets.findFirst({
    where: and(
      eq(rateLimitBuckets.instanceId, input.instanceId),
      eq(rateLimitBuckets.windowKey, windowKey),
    ),
  });

  if (!bucket) {
    await db.insert(rateLimitBuckets).values({
      id: createId(),
      instanceId: input.instanceId,
      windowKey,
      count: 1,
    });
    return;
  }

  if (bucket.count >= input.perMinuteLimit) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Per-minute sending limit exceeded for this instance.",
    });
  }

  await db
    .update(rateLimitBuckets)
    .set({ count: bucket.count + 1, updatedAt: Date.now() })
    .where(eq(rateLimitBuckets.id, bucket.id));
}

export async function enforceSendPolicy(
  db: DatabaseClient,
  input: {
    instanceId: string;
    policy: LoadedPolicy;
    message: SendPolicyInput;
  },
): Promise<void> {
  if (input.message.to.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "At least one recipient is required.",
    });
  }

  if (input.message.to.length > input.policy.maxRecipientsPerMessage) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Message exceeds max recipients per message policy.",
    });
  }

  const normalizedHeaders = new Set(
    Object.keys(input.message.headers).map(normalizeHeaderKey),
  );
  for (const requiredHeader of input.policy.requiredHeaders) {
    if (!normalizedHeaders.has(normalizeHeaderKey(requiredHeader))) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Missing required header: ${requiredHeader}`,
      });
    }
  }

  const recipientDomains = input.message.to.map(recipientDomain);
  if (input.policy.allowList.length > 0) {
    const allAllowed = recipientDomains.every((domain) =>
      includesDomainMatch(input.policy.allowList, domain),
    );

    if (!allAllowed) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "At least one recipient is not in the allow list.",
      });
    }
  }

  const deniedDomain = recipientDomains.find((domain) =>
    includesDomainMatch(input.policy.denyList, domain),
  );
  if (deniedDomain) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Recipient domain ${deniedDomain} is blocked by deny list policy.`,
    });
  }

  await consumePerMinuteLimit(db, {
    instanceId: input.instanceId,
    perMinuteLimit: input.policy.perMinuteLimit,
  });

  await checkDailyCap(db, {
    instanceId: input.instanceId,
    policy: input.policy,
  });
}
