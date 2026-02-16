import { initTRPC, TRPCError } from "@trpc/server";

import { db } from "./lib/db.js";
import type { RequestLogger } from "./lib/logger.js";
import { requireInstance } from "./services/instance-service.js";
import {
  requireRiskMembership,
  type RiskRole,
} from "./services/risk-service.js";
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

function readInputId(input: unknown, key: "riskId" | "instanceId"): string {
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

function createRiskMembershipMiddleware(minimumRole?: RiskRole) {
  return t.middleware(async ({ ctx, getRawInput, next }) => {
    const auth = ctx.auth;
    if (!auth) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      });
    }

    const riskId = readInputId(await getRawInput(), "riskId");

    await requireRiskMembership(ctx.db, {
      userId: auth.user.id,
      riskId,
      minimumRole,
    });

    return next();
  });
}

const riskMemberMiddleware = createRiskMembershipMiddleware();
const riskOperatorMiddleware = createRiskMembershipMiddleware("operator");
const riskAdminMiddleware = createRiskMembershipMiddleware("admin");
const instanceScopedMiddleware = t.middleware(async ({ ctx, getRawInput, next }) => {
  const rawInput = await getRawInput();
  await requireInstance(ctx.db, {
    riskId: readInputId(rawInput, "riskId"),
    instanceId: readInputId(rawInput, "instanceId"),
  });

  return next();
});

export const riskMemberProcedure = protectedProcedure.use(riskMemberMiddleware);
export const riskOperatorProcedure = protectedProcedure.use(
  riskOperatorMiddleware,
);
export const riskAdminProcedure = protectedProcedure.use(riskAdminMiddleware);
export const instanceScopedProcedure = riskMemberProcedure.use(
  instanceScopedMiddleware,
);
export const instanceOperatorProcedure = riskOperatorProcedure.use(
  instanceScopedMiddleware,
);
