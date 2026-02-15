import { z } from "zod";

import {
  createRouter,
  tenantMemberProcedure,
  tenantOperatorProcedure,
} from "../trpc.js";
import { recordAuditEvent } from "../services/audit-service.js";
import {
  createAgentmailDomain,
  createAgentmailInboxForInstance,
  ensurePod,
  listDomainRecords,
} from "../services/agentmail-provisioning-service.js";

export const agentmailRouter = createRouter({
  ensurePod: tenantOperatorProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        podName: z.string().min(2),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const pod = await ensurePod(ctx.db, input);
      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        tenantId: input.tenantId,
        action: "agentmail.pod.ensured",
        targetType: "tenant",
        targetId: input.tenantId,
        diff: pod,
      });

      return pod;
    }),

  createDomain: tenantOperatorProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        podId: z.string().min(1),
        domain: z.string().min(3),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const domain = await createAgentmailDomain(ctx.db, input);
      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        tenantId: input.tenantId,
        action: "agentmail.domain.created",
        targetType: "domain",
        targetId: domain.domain,
        diff: domain,
      });

      return domain;
    }),

  createInbox: tenantOperatorProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        instanceId: z.string().uuid(),
        username: z.string().min(1),
        domain: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const inbox = await createAgentmailInboxForInstance(ctx.db, input);
      await recordAuditEvent(ctx.db, {
        actorUserId: ctx.auth.user.id,
        tenantId: input.tenantId,
        action: "agentmail.inbox.created",
        targetType: "instance",
        targetId: input.instanceId,
        diff: inbox,
      });

      return inbox;
    }),

  listDomains: tenantMemberProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => listDomainRecords(ctx.db, input.tenantId)),
});
