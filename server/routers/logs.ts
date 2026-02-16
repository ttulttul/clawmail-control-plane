import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { auditLog, sendLog, webhookEvents } from "../../drizzle/schema.js";
import { parseRecord, parseStringArray } from "../lib/json-codec.js";
import { createRouter, castMemberProcedure } from "../trpc.js";

export const logsRouter = createRouter({
  sends: castMemberProcedure
    .input(
      z.object({
        castId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(50),
        instanceId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.query.sendLog.findMany({
        where:
          input.instanceId === undefined
            ? eq(sendLog.castId, input.castId)
            : and(
                eq(sendLog.castId, input.castId),
                eq(sendLog.instanceId, input.instanceId),
              ),
        orderBy: [desc(sendLog.createdAt)],
        limit: input.limit,
      });

      return rows.map((row) => ({
        id: row.id,
        instanceId: row.instanceId,
        requestId: row.requestId,
        providerRequestId: row.providerRequestId,
        fromEmail: row.fromEmail,
        recipients: parseStringArray(row.recipientsJson),
        providerStatus: row.providerStatus,
        createdAt: row.createdAt,
      }));
    }),

  events: castMemberProcedure
    .input(
      z.object({
        castId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.query.webhookEvents.findMany({
        where: eq(webhookEvents.castId, input.castId),
        orderBy: [desc(webhookEvents.receivedAt)],
        limit: input.limit,
      });

      return rows.map((row) => ({
        id: row.id,
        provider: row.provider,
        providerEventId: row.providerEventId,
        eventType: row.eventType,
        receivedAt: row.receivedAt,
        processedAt: row.processedAt,
      }));
    }),

  audit: castMemberProcedure
    .input(
      z.object({
        castId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.query.auditLog.findMany({
        where: eq(auditLog.castId, input.castId),
        orderBy: [desc(auditLog.timestamp)],
        limit: input.limit,
      });

      return rows.map((row) => ({
        id: row.id,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        timestamp: row.timestamp,
        diff: parseRecord(row.diffJson),
      }));
    }),
});
