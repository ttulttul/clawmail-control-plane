import { z } from "zod";

import {
  createRouter,
  instanceOperatorProcedure,
  instanceScopedProcedure,
  riskMemberProcedure,
  riskOperatorProcedure,
} from "../trpc.js";
import { recordAuditEvent } from "../services/audit-service.js";
import {
  createInstance,
  getPolicyForInstance,
  listInstancesByRisk,
  rotateInstanceToken,
  setInstancePolicy,
} from "../services/instance-service.js";

const policyInputSchema = z.object({
  maxRecipientsPerMessage: z.number().int().positive().max(1000),
  perMinuteLimit: z.number().int().positive().max(5000),
  dailyCap: z.number().int().positive().max(1_000_000),
  requiredHeaders: z.array(z.string().min(1)).max(20),
  allowList: z.array(z.string().min(1)).max(200),
  denyList: z.array(z.string().min(1)).max(200),
});

export const instancesRouter = createRouter({
  list: riskMemberProcedure
    .input(
      z.object({
        riskId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => listInstancesByRisk(ctx.db, input.riskId)),

  create: riskOperatorProcedure
    .input(
      z.object({
        riskId: z.string().uuid(),
        name: z.string().min(2),
        mode: z.enum(["gateway", "direct"]).default("gateway"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const instance = await createInstance(ctx.db, {
        riskId: input.riskId,
        name: input.name,
        mode: input.mode,
      });

      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        riskId: input.riskId,
        action: "instance.created",
        targetType: "instance",
        targetId: instance.instanceId,
        diff: {
          name: input.name,
          mode: input.mode,
        },
      });

      return instance;
    }),

  rotateToken: instanceOperatorProcedure
    .input(
      z.object({
        riskId: z.string().uuid(),
        instanceId: z.string().uuid(),
        scopes: z.array(z.string().min(1)).min(1),
        expiresInHours: z.number().int().positive().max(24 * 365).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const expiresAt =
        input.expiresInHours === null
          ? null
          : Date.now() + input.expiresInHours * 60 * 60 * 1000;

      const token = await rotateInstanceToken(ctx.db, {
        instanceId: input.instanceId,
        scopes: input.scopes,
        expiresAt,
      });

      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        riskId: input.riskId,
        action: "instance.token.rotated",
        targetType: "instance",
        targetId: input.instanceId,
        diff: {
          scopes: input.scopes,
          expiresAt,
        },
      });

      return token;
    }),

  getPolicy: instanceScopedProcedure
    .input(
      z.object({
        riskId: z.string().uuid(),
        instanceId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => getPolicyForInstance(ctx.db, input.instanceId)),

  setPolicy: instanceOperatorProcedure
    .input(
      z.object({
        riskId: z.string().uuid(),
        instanceId: z.string().uuid(),
        policy: policyInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await setInstancePolicy(ctx.db, {
        instanceId: input.instanceId,
        policy: input.policy,
      });

      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        riskId: input.riskId,
        action: "instance.policy.updated",
        targetType: "instance",
        targetId: input.instanceId,
        diff: input.policy,
      });

      return { success: true };
    }),
});
