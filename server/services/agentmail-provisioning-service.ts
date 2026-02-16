import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import {
  agentmailConnections,
  agentmailDomains,
  agentmailInboxes,
  agentmailPods,
  openclawInstances,
} from "../../drizzle/schema.js";
import { createProviderConnectors } from "../connectors/factory.js";
import type { DatabaseClient } from "../lib/db.js";
import { createId } from "../lib/id.js";
import { parseStringArray, safeJsonStringify } from "../lib/json-codec.js";
import { requireAgentmailConnection } from "./provider-connections-service.js";
import { withProviderErrorMapping } from "./provider-error-mapper.js";

const connectors = createProviderConnectors();

export async function ensurePod(
  db: DatabaseClient,
  input: { castId: string; podName: string },
): Promise<{ podId: string }> {
  const existing = await db.query.agentmailPods.findFirst({
    where: eq(agentmailPods.castId, input.castId),
  });

  if (existing) {
    return { podId: existing.podId };
  }

  const connection = await requireAgentmailConnection(db, input.castId);
  const pod = await withProviderErrorMapping(
    () =>
      connectors.agentmail.ensurePod({
        apiKey: connection.apiKey,
        name: input.podName,
      }),
    "Failed to create AgentMail pod.",
  );

  await db.insert(agentmailPods).values({
    id: createId(),
    castId: input.castId,
    podId: pod.podId,
  });

  await db
    .update(agentmailConnections)
    .set({ defaultPodId: pod.podId, updatedAt: Date.now() })
    .where(eq(agentmailConnections.castId, input.castId));

  return { podId: pod.podId };
}

export async function createAgentmailDomain(
  db: DatabaseClient,
  input: { castId: string; podId: string; domain: string },
): Promise<{ domain: string; status: string; dnsRecords: string[] }> {
  const connection = await requireAgentmailConnection(db, input.castId);
  const created = await withProviderErrorMapping(
    () =>
      connectors.agentmail.createDomain({
        apiKey: connection.apiKey,
        podId: input.podId,
        domain: input.domain,
      }),
    "Failed to create AgentMail domain.",
  );

  await db.insert(agentmailDomains).values({
    id: createId(),
    castId: input.castId,
    podId: input.podId,
    domain: created.domain,
    status: created.status,
    dnsRecordsJson: safeJsonStringify(created.dnsRecords, "[]"),
  });

  return created;
}

export async function createAgentmailInboxForInstance(
  db: DatabaseClient,
  input: {
    castId: string;
    instanceId: string;
    username: string;
    domain?: string;
  },
): Promise<{ inboxId: string; username: string; domain: string }> {
  const instance = await db.query.openclawInstances.findFirst({
    where: and(
      eq(openclawInstances.id, input.instanceId),
      eq(openclawInstances.castId, input.castId),
    ),
  });

  if (!instance) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Instance not found." });
  }

  const existing = await db.query.agentmailInboxes.findFirst({
    where: eq(agentmailInboxes.instanceId, input.instanceId),
  });

  if (existing) {
    return {
      inboxId: existing.inboxId,
      username: existing.username,
      domain: existing.domain,
    };
  }

  const connection = await requireAgentmailConnection(db, input.castId);
  const podId =
    connection.defaultPodId ??
    (
      await ensurePod(db, {
        castId: input.castId,
        podName: `${instance.name}-pod`,
      })
    ).podId;

  const created = await withProviderErrorMapping(
    () =>
      connectors.agentmail.createInbox({
        apiKey: connection.apiKey,
        podId,
        username: input.username,
        domain: input.domain,
      }),
    "Failed to create AgentMail inbox.",
  );

  await db.insert(agentmailInboxes).values({
    id: createId(),
    castId: input.castId,
    instanceId: input.instanceId,
    podId,
    inboxId: created.inboxId,
    username: created.username,
    domain: created.domain,
  });

  return created;
}

export async function listDomainRecords(
  db: DatabaseClient,
  castId: string,
): Promise<
  Array<{
    id: string;
    podId: string;
    domain: string;
    status: string;
    dnsRecords: string[];
  }>
> {
  const rows = await db.query.agentmailDomains.findMany({
    where: eq(agentmailDomains.castId, castId),
    orderBy: [desc(agentmailDomains.createdAt)],
  });

  return rows.map((row) => ({
    id: row.id,
    podId: row.podId,
    domain: row.domain,
    status: row.status,
    dnsRecords: parseStringArray(row.dnsRecordsJson),
  }));
}
