import { initTRPC, TRPCError } from "@trpc/server";

import { db } from "./lib/db.js";
import type { RequestLogger } from "./lib/logger.js";
import { requireInstance } from "./services/instance-service.js";
import {
  requireTenantMembership,
  type TenantRole,
} from "./services/tenant-service.js";
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

function readInputId(input: unknown, key: "tenantId" | "instanceId"): string {
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

function createTenantMembershipMiddleware(minimumRole?: TenantRole) {
  return t.middleware(async ({ ctx, getRawInput, next }) => {
    const auth = ctx.auth;
    if (!auth) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      });
    }

    const tenantId = readInputId(await getRawInput(), "tenantId");

    await requireTenantMembership(ctx.db, {
      userId: auth.user.id,
      tenantId,
      minimumRole,
    });

    return next();
  });
}

const tenantMemberMiddleware = createTenantMembershipMiddleware();
const tenantOperatorMiddleware = createTenantMembershipMiddleware("operator");
const tenantAdminMiddleware = createTenantMembershipMiddleware("admin");
const instanceScopedMiddleware = t.middleware(async ({ ctx, getRawInput, next }) => {
  const rawInput = await getRawInput();
  await requireInstance(ctx.db, {
    tenantId: readInputId(rawInput, "tenantId"),
    instanceId: readInputId(rawInput, "instanceId"),
  });

  return next();
});

export const tenantMemberProcedure = protectedProcedure.use(tenantMemberMiddleware);
export const tenantOperatorProcedure = protectedProcedure.use(
  tenantOperatorMiddleware,
);
export const tenantAdminProcedure = protectedProcedure.use(tenantAdminMiddleware);
export const instanceScopedProcedure = tenantMemberProcedure.use(
  instanceScopedMiddleware,
);
export const instanceOperatorProcedure = tenantOperatorProcedure.use(
  instanceScopedMiddleware,
);
