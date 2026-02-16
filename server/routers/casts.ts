import { z } from "zod";

import {
  createRouter,
  protectedProcedure,
  castAdminProcedure,
  castMemberProcedure,
} from "../trpc.js";
import { recordAuditEvent } from "../services/audit-service.js";
import {
  getProviderCredentialPreviews,
  saveAgentmailConnection,
  saveMailchannelsConnection,
} from "../services/provider-connections-service.js";
import {
  createCastForUser,
  listCastsForUser,
} from "../services/cast-service.js";

export const castsRouter = createRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listCastsForUser(ctx.db, ctx.auth.user.id);
  }),

  providerStatus: castMemberProcedure
    .input(
      z.object({
        castId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return getProviderCredentialPreviews(ctx.db, input.castId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cast = await createCastForUser(ctx.db, {
        userId: ctx.auth.user.id,
        name: input.name,
      });

      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        castId: cast.castId,
        action: "cast.created",
        targetType: "cast",
        targetId: cast.castId,
        diff: { name: input.name },
      });

      return cast;
    }),

  connectMailchannels: castAdminProcedure
    .input(
      z.object({
        castId: z.string().uuid(),
        accountId: z.string().min(1).optional(),
        parentApiKey: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await saveMailchannelsConnection(ctx.db, {
        castId: input.castId,
        mailchannelsAccountId: input.accountId,
        parentApiKey: input.parentApiKey,
      });

      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        castId: input.castId,
        action: "mailchannels.connection.saved",
        targetType: "mailchannels_connection",
        targetId: input.castId,
        diff: {
          accountId: input.accountId ?? null,
          parentApiKeyUpdated: input.parentApiKey ? true : null,
        },
      });

      return { success: true };
    }),

  connectAgentmail: castAdminProcedure
    .input(
      z.object({
        castId: z.string().uuid(),
        apiKey: z.string().min(1),
        defaultPodId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await saveAgentmailConnection(ctx.db, {
        castId: input.castId,
        apiKey: input.apiKey,
        defaultPodId: input.defaultPodId,
      });

      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        castId: input.castId,
        action: "agentmail.connection.saved",
        targetType: "agentmail_connection",
        targetId: input.castId,
        diff: { defaultPodId: input.defaultPodId ?? null },
      });

      return { success: true };
    }),
});
