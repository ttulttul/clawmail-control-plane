import { z } from "zod";

import {
  createRouter,
  riskMemberProcedure,
  riskOperatorProcedure,
} from "../trpc.js";
import { recordAuditEvent } from "../services/audit-service.js";
import {
  createAgentmailDomain,
  createAgentmailInboxForInstance,
  ensurePod,
  listDomainRecords,
} from "../services/agentmail-provisioning-service.js";

export const agentmailRouter = createRouter({
  ensurePod: riskOperatorProcedure
    .input(
      z.object({
        riskId: z.string().uuid(),
        podName: z.string().min(2),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const pod = await ensurePod(ctx.db, input);
      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        riskId: input.riskId,
        action: "agentmail.pod.ensured",
        targetType: "risk",
        targetId: input.riskId,
        diff: pod,
      });

      return pod;
    }),

  createDomain: riskOperatorProcedure
    .input(
      z.object({
        riskId: z.string().uuid(),
        podId: z.string().min(1),
        domain: z.string().min(3),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const domain = await createAgentmailDomain(ctx.db, input);
      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        riskId: input.riskId,
        action: "agentmail.domain.created",
        targetType: "domain",
        targetId: domain.domain,
        diff: domain,
      });

      return domain;
    }),

  createInbox: riskOperatorProcedure
    .input(
      z.object({
        riskId: z.string().uuid(),
        instanceId: z.string().uuid(),
        username: z.string().min(1),
        domain: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const inbox = await createAgentmailInboxForInstance(ctx.db, input);
      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        riskId: input.riskId,
        action: "agentmail.inbox.created",
        targetType: "instance",
        targetId: input.instanceId,
        diff: inbox,
      });

      return inbox;
    }),

  listDomains: riskMemberProcedure
    .input(
      z.object({
        riskId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => listDomainRecords(ctx.db, input.riskId)),
});
