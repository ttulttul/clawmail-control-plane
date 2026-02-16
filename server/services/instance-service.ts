import { and, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import {
  instancePolicies,
  instanceTokens,
  openclawInstances,
} from "../../drizzle/schema.js";
import type { DatabaseClient } from "../lib/db.js";
import { createId } from "../lib/id.js";
import { parseStringArray, safeJsonStringify } from "../lib/json-codec.js";
import { generateOpaqueToken, hashToken } from "../lib/token.js";

export interface CreateInstanceInput {
  castId: string;
  name: string;
  mode: "gateway" | "direct";
}

export async function createInstance(
  db: DatabaseClient,
  input: CreateInstanceInput,
): Promise<{ instanceId: string }> {
  const instanceId = createId();

  db.transaction((tx) => {
    tx
      .insert(openclawInstances)
      .values({
        id: instanceId,
        castId: input.castId,
        name: input.name,
        mode: input.mode,
        status: "active",
      })
      .run();

    tx
      .insert(instancePolicies)
      .values({
        id: createId(),
        instanceId,
        maxRecipientsPerMessage: 10,
        perMinuteLimit: 30,
        dailyCap: 500,
        requiredHeadersJson: safeJsonStringify(
          ["X-AI-Bot", "List-Unsubscribe"],
          "[]",
        ),
        allowListJson: safeJsonStringify([], "[]"),
        denyListJson: safeJsonStringify([], "[]"),
      })
      .run();
  });

  return { instanceId };
}

export async function listInstancesByCast(
  db: DatabaseClient,
  castId: string,
): Promise<
  Array<{
    id: string;
    name: string;
    status: "active" | "suspended" | "deprovisioned";
    mode: "gateway" | "direct";
    createdAt: number;
  }>
> {
  const rows = await db.query.openclawInstances.findMany({
    where: eq(openclawInstances.castId, castId),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    mode: row.mode,
    createdAt: row.createdAt,
  }));
}

export async function requireInstance(
  db: DatabaseClient,
  input: { instanceId: string; castId?: string },
): Promise<{
  id: string;
  castId: string;
  status: "active" | "suspended" | "deprovisioned";
  name: string;
  mode: "gateway" | "direct";
}> {
  const instance = await db.query.openclawInstances.findFirst({
    where:
      input.castId !== undefined
        ? and(
            eq(openclawInstances.id, input.instanceId),
            eq(openclawInstances.castId, input.castId),
          )
        : eq(openclawInstances.id, input.instanceId),
  });

  if (!instance) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Instance not found.",
    });
  }

  return instance;
}

export async function setInstanceStatus(
  db: DatabaseClient,
  input: { instanceId: string; status: "active" | "suspended" | "deprovisioned" },
): Promise<void> {
  await db
    .update(openclawInstances)
    .set({ status: input.status, updatedAt: Date.now() })
    .where(eq(openclawInstances.id, input.instanceId));
}

export interface PolicyInput {
  maxRecipientsPerMessage: number;
  perMinuteLimit: number;
  dailyCap: number;
  requiredHeaders: string[];
  allowList: string[];
  denyList: string[];
}

export interface LoadedPolicy extends PolicyInput {
  instanceId: string;
}

export async function setInstancePolicy(
  db: DatabaseClient,
  input: { instanceId: string; policy: PolicyInput },
): Promise<void> {
  const existing = await db.query.instancePolicies.findFirst({
    where: eq(instancePolicies.instanceId, input.instanceId),
  });

  if (!existing) {
    await db.insert(instancePolicies).values({
      id: createId(),
      instanceId: input.instanceId,
      maxRecipientsPerMessage: input.policy.maxRecipientsPerMessage,
      perMinuteLimit: input.policy.perMinuteLimit,
      dailyCap: input.policy.dailyCap,
      requiredHeadersJson: safeJsonStringify(input.policy.requiredHeaders, "[]"),
      allowListJson: safeJsonStringify(input.policy.allowList, "[]"),
      denyListJson: safeJsonStringify(input.policy.denyList, "[]"),
    });

    return;
  }

  await db
    .update(instancePolicies)
    .set({
      maxRecipientsPerMessage: input.policy.maxRecipientsPerMessage,
      perMinuteLimit: input.policy.perMinuteLimit,
      dailyCap: input.policy.dailyCap,
      requiredHeadersJson: safeJsonStringify(input.policy.requiredHeaders, "[]"),
      allowListJson: safeJsonStringify(input.policy.allowList, "[]"),
      denyListJson: safeJsonStringify(input.policy.denyList, "[]"),
      updatedAt: Date.now(),
    })
    .where(eq(instancePolicies.instanceId, input.instanceId));
}

export async function getPolicyForInstance(
  db: DatabaseClient,
  instanceId: string,
): Promise<LoadedPolicy> {
  const policy = await db.query.instancePolicies.findFirst({
    where: eq(instancePolicies.instanceId, instanceId),
  });

  if (!policy) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Policy not found for instance.",
    });
  }

  return {
    instanceId,
    maxRecipientsPerMessage: policy.maxRecipientsPerMessage,
    perMinuteLimit: policy.perMinuteLimit,
    dailyCap: policy.dailyCap,
    requiredHeaders: parseStringArray(policy.requiredHeadersJson),
    allowList: parseStringArray(policy.allowListJson),
    denyList: parseStringArray(policy.denyListJson),
  };
}

export async function rotateInstanceToken(
  db: DatabaseClient,
  input: {
    instanceId: string;
    scopes: string[];
    expiresAt: number | null;
  },
): Promise<{ token: string; tokenId: string }> {
  const activeToken = await db.query.instanceTokens.findFirst({
    where: and(
      eq(instanceTokens.instanceId, input.instanceId),
      isNull(instanceTokens.revokedAt),
    ),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  const token = generateOpaqueToken();
  const tokenId = createId();

  db.transaction((tx) => {
    if (activeToken) {
      tx
        .update(instanceTokens)
        .set({ revokedAt: Date.now() })
        .where(eq(instanceTokens.id, activeToken.id))
        .run();
    }

    tx
      .insert(instanceTokens)
      .values({
        id: tokenId,
        instanceId: input.instanceId,
        tokenHash: hashToken(token),
        scopesJson: safeJsonStringify(input.scopes, "[]"),
        expiresAt: input.expiresAt,
        rotatedFrom: activeToken?.id ?? null,
        revokedAt: null,
      })
      .run();
  });

  return { token, tokenId };
}

export async function authenticateInstanceToken(
  db: DatabaseClient,
  token: string,
): Promise<{ instanceId: string; castId: string; scopes: string[] } | null> {
  const tokenHash = hashToken(token);
  const row = await db.query.instanceTokens.findFirst({
    where: and(eq(instanceTokens.tokenHash, tokenHash), isNull(instanceTokens.revokedAt)),
    with: {
      instance: true,
    },
  });

  if (!row) {
    return null;
  }

  if (row.expiresAt !== null && row.expiresAt < Date.now()) {
    return null;
  }

  const scopes = parseStringArray(row.scopesJson);

  return {
    instanceId: row.instanceId,
    castId: row.instance.castId,
    scopes,
  };
}
