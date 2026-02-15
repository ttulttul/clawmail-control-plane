import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { auditLog, sendLog, webhookEvents } from "../../drizzle/schema.js";
import { createRouter, protectedProcedure } from "../trpc.js";
import { requireTenantMembership } from "../services/tenant-service.js";

export const logsRouter = createRouter({
  sends: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(50),
        instanceId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.db, {
        userId: ctx.auth.user.id,
        tenantId: input.tenantId,
      });

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
        recipients: JSON.parse(row.recipientsJson) as string[],
        providerStatus: row.providerStatus,
        createdAt: row.createdAt,
      }));
    }),

  events: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.db, {
        userId: ctx.auth.user.id,
        tenantId: input.tenantId,
      });

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

  audit: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.db, {
        userId: ctx.auth.user.id,
        tenantId: input.tenantId,
      });

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
        diff: JSON.parse(row.diffJson) as Record<string, unknown>,
      }));
    }),
});
