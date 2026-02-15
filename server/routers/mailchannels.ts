import { z } from "zod";

import {
  createRouter,
  tenantAdminProcedure,
  tenantMemberProcedure,
  tenantOperatorProcedure,
} from "../trpc.js";
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

const tenantInstanceSchema = z.object({
  tenantId: z.string().uuid(),
  instanceId: z.string().uuid(),
});

export const mailchannelsRouter = createRouter({
  provisionSubaccount: tenantOperatorProcedure
    .input(
      tenantInstanceSchema.extend({
        limit: z.number().int().min(-1).default(1000),
        suspended: z.boolean().default(false),
        persistDirectKey: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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

  suspendSubaccount: tenantOperatorProcedure
    .input(tenantInstanceSchema)
    .mutation(async ({ ctx, input }) => {
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

  activateSubaccount: tenantOperatorProcedure
    .input(tenantInstanceSchema)
    .mutation(async ({ ctx, input }) => {
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

  setLimit: tenantOperatorProcedure
    .input(
      tenantInstanceSchema.extend({
        limit: z.number().int().min(-1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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

  deleteLimit: tenantOperatorProcedure
    .input(tenantInstanceSchema)
    .mutation(async ({ ctx, input }) => {
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

  rotateSubaccountKey: tenantOperatorProcedure
    .input(
      tenantInstanceSchema.extend({
        persistDirectKey: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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

  syncUsage: tenantMemberProcedure
    .input(tenantInstanceSchema)
    .mutation(async ({ ctx, input }) => syncSubaccountUsage(ctx.db, input)),

  validateWebhook: tenantAdminProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      validateMailchannelsWebhook(ctx.db, input.tenantId),
    ),
});
