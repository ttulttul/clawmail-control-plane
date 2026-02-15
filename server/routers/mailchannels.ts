import { z } from "zod";

import { createRouter, protectedProcedure } from "../trpc.js";
import { recordAuditEvent } from "../services/audit-service.js";
import {
  activateSubaccount,
  deleteSubaccountLimit,
  provisionMailchannelsSubaccount,
  rotateSubaccountKey,
  setSubaccountLimit,
  suspendSubaccount,
  syncSubaccountUsage,
  validateMailchannelsWebhook,
} from "../services/mailchannels-provisioning-service.js";
import { requireTenantMembership } from "../services/tenant-service.js";

const tenantInstanceSchema = z.object({
  tenantId: z.string().uuid(),
  instanceId: z.string().uuid(),
});

export const mailchannelsRouter = createRouter({
  provisionSubaccount: protectedProcedure
    .input(
      tenantInstanceSchema.extend({
        limit: z.number().int().min(-1).default(1000),
        suspended: z.boolean().default(false),
        persistDirectKey: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.db, {
        userId: ctx.auth.user.id,
        tenantId: input.tenantId,
        minimumRole: "operator",
      });

      const provisioned = await provisionMailchannelsSubaccount(ctx.db, input);

      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        tenantId: input.tenantId,
        action: "mailchannels.subaccount.provisioned",
        targetType: "instance",
        targetId: input.instanceId,
        diff: {
          handle: provisioned.handle,
          limit: input.limit,
          suspended: input.suspended,
        },
      });

      return provisioned;
    }),

  suspendSubaccount: protectedProcedure
    .input(tenantInstanceSchema)
    .mutation(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.db, {
        userId: ctx.auth.user.id,
        tenantId: input.tenantId,
        minimumRole: "operator",
      });

      await suspendSubaccount(ctx.db, input);
      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        tenantId: input.tenantId,
        action: "mailchannels.subaccount.suspended",
        targetType: "instance",
        targetId: input.instanceId,
        diff: {},
      });

      return { success: true };
    }),

  activateSubaccount: protectedProcedure
    .input(tenantInstanceSchema)
    .mutation(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.db, {
        userId: ctx.auth.user.id,
        tenantId: input.tenantId,
        minimumRole: "operator",
      });

      await activateSubaccount(ctx.db, input);
      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        tenantId: input.tenantId,
        action: "mailchannels.subaccount.activated",
        targetType: "instance",
        targetId: input.instanceId,
        diff: {},
      });

      return { success: true };
    }),

  setLimit: protectedProcedure
    .input(
      tenantInstanceSchema.extend({
        limit: z.number().int().min(-1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.db, {
        userId: ctx.auth.user.id,
        tenantId: input.tenantId,
        minimumRole: "operator",
      });

      await setSubaccountLimit(ctx.db, input);
      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        tenantId: input.tenantId,
        action: "mailchannels.subaccount.limit_set",
        targetType: "instance",
        targetId: input.instanceId,
        diff: { limit: input.limit },
      });

      return { success: true };
    }),

  deleteLimit: protectedProcedure
    .input(tenantInstanceSchema)
    .mutation(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.db, {
        userId: ctx.auth.user.id,
        tenantId: input.tenantId,
        minimumRole: "operator",
      });

      await deleteSubaccountLimit(ctx.db, input);
      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        tenantId: input.tenantId,
        action: "mailchannels.subaccount.limit_deleted",
        targetType: "instance",
        targetId: input.instanceId,
        diff: {},
      });

      return { success: true };
    }),

  rotateSubaccountKey: protectedProcedure
    .input(
      tenantInstanceSchema.extend({
        persistDirectKey: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.db, {
        userId: ctx.auth.user.id,
        tenantId: input.tenantId,
        minimumRole: "operator",
      });

      const rotated = await rotateSubaccountKey(ctx.db, input);
      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        tenantId: input.tenantId,
        action: "mailchannels.subaccount.key_rotated",
        targetType: "instance",
        targetId: input.instanceId,
        diff: {},
      });

      return rotated;
    }),

  syncUsage: protectedProcedure
    .input(tenantInstanceSchema)
    .mutation(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.db, {
        userId: ctx.auth.user.id,
        tenantId: input.tenantId,
      });

      return syncSubaccountUsage(ctx.db, input);
    }),

  validateWebhook: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.db, {
        userId: ctx.auth.user.id,
        tenantId: input.tenantId,
        minimumRole: "admin",
      });

      return validateMailchannelsWebhook(ctx.db, input.tenantId);
    }),
});
