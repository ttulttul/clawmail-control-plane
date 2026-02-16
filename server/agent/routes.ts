import { Hono } from "hono";
import { z } from "zod";

import { db } from "../lib/db.js";
import {
  getInboxMessage,
  listGatewayEvents,
  listInboxThreads,
  replyInboxMessage,
  sendViaGateway,
} from "../services/gateway-service.js";
import type { AppVariables } from "../types/hono.js";

const sendSchema = z.object({
  from: z.string().email(),
  to: z.array(z.string().email()).min(1),
  subject: z.string().min(1),
  textBody: z.string().min(1),
  htmlBody: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

const replySchema = z.object({
  messageId: z.string().min(1),
  body: z.string().min(1),
});

function requireScope(scopes: string[], expected: string): boolean {
  return scopes.includes(expected) || scopes.includes("*");
}

export const agentRouter = new Hono<{ Variables: AppVariables }>();

agentRouter.post("/send", async (c) => {
  const auth = c.get("agentAuth");
  if (!auth) {
    return c.json({ error: "Agent authentication required." }, 401);
  }

  if (!requireScope(auth.scopes, "send")) {
    return c.json({ error: "Token does not allow sending." }, 403);
  }

  const parsed = sendSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const response = await sendViaGateway(
    db,
    c.get("logger"),
    c.get("requestId"),
    {
      castId: auth.castId,
      instanceId: auth.instanceId,
      ...parsed.data,
    },
  );

  return c.json(response, 202);
});

agentRouter.get("/events", async (c) => {
  const auth = c.get("agentAuth");
  if (!auth) {
    return c.json({ error: "Agent authentication required." }, 401);
  }

  const limitParam = c.req.query("limit");
  const limit = limitParam ? Number(limitParam) : 50;

  const events = await listGatewayEvents(db, {
    castId: auth.castId,
    instanceId: auth.instanceId,
    limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 200)) : 50,
  });

  return c.json({ events });
});

agentRouter.get("/inbox/threads", async (c) => {
  const auth = c.get("agentAuth");
  if (!auth) {
    return c.json({ error: "Agent authentication required." }, 401);
  }

  if (!requireScope(auth.scopes, "read_inbox")) {
    return c.json({ error: "Token does not allow inbox reads." }, 403);
  }

  const threads = await listInboxThreads(db, {
    castId: auth.castId,
    instanceId: auth.instanceId,
  });

  return c.json({ threads });
});

agentRouter.get("/inbox/messages/:id", async (c) => {
  const auth = c.get("agentAuth");
  if (!auth) {
    return c.json({ error: "Agent authentication required." }, 401);
  }

  if (!requireScope(auth.scopes, "read_inbox")) {
    return c.json({ error: "Token does not allow inbox reads." }, 403);
  }

  const message = await getInboxMessage(db, {
    castId: auth.castId,
    instanceId: auth.instanceId,
    messageId: c.req.param("id"),
  });

  return c.json(message);
});

agentRouter.post("/inbox/reply", async (c) => {
  const auth = c.get("agentAuth");
  if (!auth) {
    return c.json({ error: "Agent authentication required." }, 401);
  }

  if (!requireScope(auth.scopes, "read_inbox")) {
    return c.json({ error: "Token does not allow inbox access." }, 403);
  }

  const parsed = replySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const reply = await replyInboxMessage(db, {
    castId: auth.castId,
    instanceId: auth.instanceId,
    messageId: parsed.data.messageId,
    body: parsed.data.body,
  });

  return c.json(reply, 201);
});
