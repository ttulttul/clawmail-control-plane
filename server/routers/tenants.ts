import { z } from "zod";

import { createRouter, protectedProcedure, tenantAdminProcedure } from "../trpc.js";
import { recordAuditEvent } from "../services/audit-service.js";
import {
  saveAgentmailConnection,
  saveMailchannelsConnection,
} from "../services/provider-connections-service.js";
import {
  createTenantForUser,
  listTenantsForUser,
} from "../services/tenant-service.js";

export const tenantsRouter = createRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listTenantsForUser(ctx.db, ctx.auth.user.id);
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = await createTenantForUser(ctx.db, {
        userId: ctx.auth.user.id,
        name: input.name,
      });

      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        tenantId: tenant.tenantId,
        action: "tenant.created",
        targetType: "tenant",
        targetId: tenant.tenantId,
        diff: { name: input.name },
      });

      return tenant;
    }),

  connectMailchannels: tenantAdminProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        accountId: z.string().min(1),
        parentApiKey: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await saveMailchannelsConnection(ctx.db, {
        tenantId: input.tenantId,
        mailchannelsAccountId: input.accountId,
        parentApiKey: input.parentApiKey,
      });

      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        tenantId: input.tenantId,
        action: "mailchannels.connection.saved",
        targetType: "mailchannels_connection",
        targetId: input.tenantId,
        diff: { accountId: input.accountId },
      });

      return { success: true };
    }),

  connectAgentmail: tenantAdminProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        apiKey: z.string().min(1),
        defaultPodId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await saveAgentmailConnection(ctx.db, {
        tenantId: input.tenantId,
        apiKey: input.apiKey,
        defaultPodId: input.defaultPodId,
      });

      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        tenantId: input.tenantId,
        action: "agentmail.connection.saved",
        targetType: "agentmail_connection",
        targetId: input.tenantId,
        diff: { defaultPodId: input.defaultPodId ?? null },
      });

      return { success: true };
    }),
});
