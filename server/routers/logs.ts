import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { auditLog, sendLog, webhookEvents } from "../../drizzle/schema.js";
import { parseRecord, parseStringArray } from "../lib/json-codec.js";
import { createRouter, tenantMemberProcedure } from "../trpc.js";

export const logsRouter = createRouter({
  sends: tenantMemberProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(50),
        instanceId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.query.sendLog.findMany({
        where:
          input.instanceId === undefined
            ? eq(sendLog.tenantId, input.tenantId)
            : and(
                eq(sendLog.tenantId, input.tenantId),
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

  events: tenantMemberProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.query.webhookEvents.findMany({
        where: eq(webhookEvents.tenantId, input.tenantId),
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

  audit: tenantMemberProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.query.auditLog.findMany({
        where: eq(auditLog.tenantId, input.tenantId),
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
