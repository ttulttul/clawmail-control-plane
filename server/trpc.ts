import { initTRPC, TRPCError } from "@trpc/server";

import { db } from "./lib/db.js";
import type { RequestLogger } from "./lib/logger.js";
import { requireInstance } from "./services/instance-service.js";
import {
  requireCastMembership,
  type CastRole,
} from "./services/cast-service.js";
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

function readInputId(input: unknown, key: "castId" | "instanceId"): string {
  if (typeof input !== "object" || input === null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Missing required ${key}.`,
    });
  }

  const value = (input as Record<string, unknown>)[key];
  if (typeof value !== "string") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Missing required ${key}.`,
    });
  }

  return value;
}

function createCastMembershipMiddleware(minimumRole?: CastRole) {
  return t.middleware(async ({ ctx, getRawInput, next }) => {
    const auth = ctx.auth;
    if (!auth) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      });
    }

    const castId = readInputId(await getRawInput(), "castId");

    await requireCastMembership(ctx.db, {
      userId: auth.user.id,
      castId,
      minimumRole,
    });

    return next();
  });
}

const castMemberMiddleware = createCastMembershipMiddleware();
const castOperatorMiddleware = createCastMembershipMiddleware("operator");
const castAdminMiddleware = createCastMembershipMiddleware("admin");
const instanceScopedMiddleware = t.middleware(async ({ ctx, getRawInput, next }) => {
  const rawInput = await getRawInput();
  await requireInstance(ctx.db, {
    castId: readInputId(rawInput, "castId"),
    instanceId: readInputId(rawInput, "instanceId"),
  });

  return next();
});

export const castMemberProcedure = protectedProcedure.use(castMemberMiddleware);
export const castOperatorProcedure = protectedProcedure.use(
  castOperatorMiddleware,
);
export const castAdminProcedure = protectedProcedure.use(castAdminMiddleware);
export const instanceScopedProcedure = castMemberProcedure.use(
  instanceScopedMiddleware,
);
export const instanceOperatorProcedure = castOperatorProcedure.use(
  instanceScopedMiddleware,
);
