import type { MiddlewareHandler } from "hono";

import { db } from "../lib/db.js";
import { authenticateInstanceToken } from "../services/instance-service.js";
import type { AppVariables } from "../types/hono.js";

function extractBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue) {
    return null;
  }

  if (!headerValue.startsWith("Bearer ")) {
    return null;
  }

  const token = headerValue.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export const requireAgentAuth: MiddlewareHandler<{
  Variables: AppVariables;
}> = async (c, next) => {
  const token =
    extractBearerToken(c.req.header("authorization")) ??
    c.req.header("x-instance-token") ??
    null;

  if (!token) {
    return c.json({ error: "Missing agent token." }, 401);
  }

  const authenticated = await authenticateInstanceToken(db, token);
  if (!authenticated) {
    return c.json({ error: "Invalid or expired agent token." }, 401);
  }

  c.set("agentAuth", {
    instanceId: authenticated.instanceId,
    castId: authenticated.castId,
    scopes: authenticated.scopes,
  });

  await next();
};
