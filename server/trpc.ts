import { initTRPC, TRPCError } from "@trpc/server";

import { db } from "./lib/db.js";
import type { RequestLogger } from "./lib/logger.js";
import type { AuthVariables } from "./types/hono.js";

export interface TrpcContext {
  db: typeof db;
  logger: RequestLogger;
  requestId: string;
  auth: AuthVariables | null;
  resHeaders: Headers;
}

export const t = initTRPC.context<TrpcContext>().create();

const authenticatedMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      auth: ctx.auth,
    },
  });
});

export const createRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(authenticatedMiddleware);
