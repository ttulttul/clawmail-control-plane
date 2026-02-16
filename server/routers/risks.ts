import { z } from "zod";

import {
  createRouter,
  protectedProcedure,
  riskAdminProcedure,
  riskMemberProcedure,
} from "../trpc.js";
import { recordAuditEvent } from "../services/audit-service.js";
import {
  getProviderCredentialPreviews,
  saveAgentmailConnection,
  saveMailchannelsConnection,
} from "../services/provider-connections-service.js";
import {
  createRiskForUser,
  listRisksForUser,
} from "../services/risk-service.js";

export const risksRouter = createRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listRisksForUser(ctx.db, ctx.auth.user.id);
  }),

  providerStatus: riskMemberProcedure
    .input(
      z.object({
        riskId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return getProviderCredentialPreviews(ctx.db, input.riskId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const risk = await createRiskForUser(ctx.db, {
        userId: ctx.auth.user.id,
        name: input.name,
      });

      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        riskId: risk.riskId,
        action: "risk.created",
        targetType: "risk",
        targetId: risk.riskId,
        diff: { name: input.name },
      });

      return risk;
    }),

  connectMailchannels: riskAdminProcedure
    .input(
      z.object({
        riskId: z.string().uuid(),
        accountId: z.string().min(1).optional(),
        parentApiKey: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await saveMailchannelsConnection(ctx.db, {
        riskId: input.riskId,
        mailchannelsAccountId: input.accountId,
        parentApiKey: input.parentApiKey,
      });

      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        riskId: input.riskId,
        action: "mailchannels.connection.saved",
        targetType: "mailchannels_connection",
        targetId: input.riskId,
        diff: {
          accountId: input.accountId ?? null,
          parentApiKeyUpdated: input.parentApiKey ? true : null,
        },
      });

      return { success: true };
    }),

  connectAgentmail: riskAdminProcedure
    .input(
      z.object({
        riskId: z.string().uuid(),
        apiKey: z.string().min(1),
        defaultPodId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await saveAgentmailConnection(ctx.db, {
        riskId: input.riskId,
        apiKey: input.apiKey,
        defaultPodId: input.defaultPodId,
      });

      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        riskId: input.riskId,
        action: "agentmail.connection.saved",
        targetType: "agentmail_connection",
        targetId: input.riskId,
        diff: { defaultPodId: input.defaultPodId ?? null },
      });

      return { success: true };
    }),
});
