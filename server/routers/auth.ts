import { z } from "zod";
import { eq } from "drizzle-orm";

import { lucia } from "../auth/lucia.js";
import { createRouter, protectedProcedure, publicProcedure } from "../trpc.js";
import { authenticateUser, registerUser } from "../services/auth-service.js";
import { createTenantForUser } from "../services/tenant-service.js";
import { users } from "../../drizzle/schema.js";

export const authRouter = createRouter({
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(12),
        tenantName: z.string().min(2).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await registerUser(ctx.db, {
        email: input.email.toLowerCase(),
        password: input.password,
      });

      if (input.tenantName) {
        await createTenantForUser(ctx.db, {
          userId: user.userId,
          name: input.tenantName,
        });
      }

      const session = await lucia.createSession(user.userId, {});
      const sessionCookie = lucia.createSessionCookie(session.id);
      ctx.resHeaders.append("set-cookie", sessionCookie.serialize());

      return { userId: user.userId };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await authenticateUser(ctx.db, {
        email: input.email.toLowerCase(),
        password: input.password,
      });

      const session = await lucia.createSession(user.userId, {});
      const sessionCookie = lucia.createSessionCookie(session.id);
      ctx.resHeaders.append("set-cookie", sessionCookie.serialize());

      return { userId: user.userId };
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    await lucia.invalidateSession(ctx.auth.session.id);
    const blankCookie = lucia.createBlankSessionCookie();
    ctx.resHeaders.append("set-cookie", blankCookie.serialize());

    return { success: true };
  }),

  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.auth) {
      return null;
    }

    const user = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.auth.user.id),
    });

    return {
      id: ctx.auth.user.id,
      email: user?.email ?? null,
      sessionId: ctx.auth.session.id,
    };
  }),
});
