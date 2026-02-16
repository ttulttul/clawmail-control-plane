import { Hono } from "hono";
import { z } from "zod";

import { db } from "../lib/db.js";
import type { AppVariables } from "../types/hono.js";
import {
  markWebhookProcessed,
  storeWebhookEvent,
  verifyMailchannelsWebhookHeaders,
  verifySharedWebhookSecret,
} from "../services/webhook-service.js";

const mailchannelsEventSchema = z.object({
  request_id: z.string().min(1),
  event: z.string().min(1),
  customer_handle: z.string().optional(),
  payload: z.unknown().optional(),
});

const agentmailEventSchema = z.object({
  id: z.string().min(1),
  event: z.string().min(1),
  instanceId: z.string().uuid().optional(),
  riskId: z.string().uuid().optional(),
  payload: z.unknown().optional(),
});

export const webhookRouter = new Hono<{ Variables: AppVariables }>();

webhookRouter.post("/mailchannels", async (c) => {
  verifySharedWebhookSecret(c.req.header("x-webhook-secret"));

  verifyMailchannelsWebhookHeaders({
    contentDigest: c.req.header("content-digest"),
    signature: c.req.header("signature"),
    signatureInput: c.req.header("signature-input"),
  });

  const jsonBody = await c.req.json();
  const parsed = mailchannelsEventSchema.safeParse(jsonBody);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const event = await storeWebhookEvent(db, {
    provider: "mailchannels",
    providerEventId: parsed.data.request_id,
    eventType: parsed.data.event,
    payload: parsed.data,
  });

  if (!event.duplicate) {
    await markWebhookProcessed(db, event.id);
  }

  return c.json({ accepted: true, duplicate: event.duplicate });
});

webhookRouter.post("/agentmail", async (c) => {
  verifySharedWebhookSecret(c.req.header("x-webhook-secret"));

  const jsonBody = await c.req.json();
  const parsed = agentmailEventSchema.safeParse(jsonBody);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const event = await storeWebhookEvent(db, {
    provider: "agentmail",
    providerEventId: parsed.data.id,
    eventType: parsed.data.event,
    riskId: parsed.data.riskId,
    instanceId: parsed.data.instanceId,
    payload: parsed.data,
  });

  if (!event.duplicate) {
    await markWebhookProcessed(db, event.id);
  }

  return c.json({ accepted: true, duplicate: event.duplicate });
});
