import { z } from "zod";

import { createRouter, protectedProcedure } from "../trpc.js";
import { recordAuditEvent } from "../services/audit-service.js";
import {
  createInstance,
  getPolicyForInstance,
  listInstancesByTenant,
  requireInstance,
  rotateInstanceToken,
  setInstancePolicy,
} from "../services/instance-service.js";
import { requireTenantMembership } from "../services/tenant-service.js";

const policyInputSchema = z.object({
  maxRecipientsPerMessage: z.number().int().positive().max(1000),
  perMinuteLimit: z.number().int().positive().max(5000),
  dailyCap: z.number().int().positive().max(1_000_000),
  requiredHeaders: z.array(z.string().min(1)).max(20),
  allowList: z.array(z.string().min(1)).max(200),
  denyList: z.array(z.string().min(1)).max(200),
});

export const instancesRouter = createRouter({
  list: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.db, {
        userId: ctx.auth.user.id,
        tenantId: input.tenantId,
      });

      return listInstancesByTenant(ctx.db, input.tenantId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        name: z.string().min(2),
        mode: z.enum(["gateway", "direct"]).default("gateway"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.db, {
        userId: ctx.auth.user.id,
        tenantId: input.tenantId,
        minimumRole: "operator",
      });

      const instance = await createInstance(ctx.db, {
        tenantId: input.tenantId,
        name: input.name,
        mode: input.mode,
      });

      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        tenantId: input.tenantId,
        action: "instance.created",
        targetType: "instance",
        targetId: instance.instanceId,
        diff: {
          name: input.name,
          mode: input.mode,
        },
      });

      return instance;
    }),

  rotateToken: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        instanceId: z.string().uuid(),
        scopes: z.array(z.string().min(1)).min(1),
        expiresInHours: z.number().int().positive().max(24 * 365).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.db, {
        userId: ctx.auth.user.id,
        tenantId: input.tenantId,
        minimumRole: "operator",
      });

      await requireInstance(ctx.db, {
        instanceId: input.instanceId,
        tenantId: input.tenantId,
      });

      const expiresAt =
        input.expiresInHours === null
          ? null
          : Date.now() + input.expiresInHours * 60 * 60 * 1000;

      const token = await rotateInstanceToken(ctx.db, {
        instanceId: input.instanceId,
        scopes: input.scopes,
        expiresAt,
      });

      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        tenantId: input.tenantId,
        action: "instance.token.rotated",
        targetType: "instance",
        targetId: input.instanceId,
        diff: {
          scopes: input.scopes,
          expiresAt,
        },
      });

      return token;
    }),

  getPolicy: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        instanceId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.db, {
        userId: ctx.auth.user.id,
        tenantId: input.tenantId,
      });

      await requireInstance(ctx.db, {
        instanceId: input.instanceId,
        tenantId: input.tenantId,
      });

      return getPolicyForInstance(ctx.db, input.instanceId);
    }),

  setPolicy: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        instanceId: z.string().uuid(),
        policy: policyInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.db, {
        userId: ctx.auth.user.id,
        tenantId: input.tenantId,
        minimumRole: "operator",
      });

      await requireInstance(ctx.db, {
        instanceId: input.instanceId,
        tenantId: input.tenantId,
      });

      await setInstancePolicy(ctx.db, {
        instanceId: input.instanceId,
        policy: input.policy,
      });

      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        tenantId: input.tenantId,
        action: "instance.policy.updated",
        targetType: "instance",
        targetId: input.instanceId,
        diff: input.policy,
      });

      return { success: true };
    }),
});
