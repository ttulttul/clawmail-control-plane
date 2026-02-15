import { randomUUID } from "node:crypto";

import { getCookie } from "hono/cookie";
import type { MiddlewareHandler } from "hono";

import { lucia } from "../auth/lucia.js";
import { createRequestLogger } from "../lib/logger.js";
import type { AppVariables } from "../types/hono.js";

export const requestContextMiddleware: MiddlewareHandler<{
  Variables: AppVariables;
}> = async (c, next) => {
  const requestId = c.req.header("x-request-id") ?? randomUUID();
  const logger = createRequestLogger(requestId);
  c.set("requestId", requestId);
  c.set("logger", logger);
  c.set("auth", null);
  c.set("agentAuth", null);

  const sessionCookie = getCookie(c, lucia.sessionCookieName);
  if (sessionCookie) {
    const { session, user } = await lucia.validateSession(sessionCookie);

    if (session) {
      c.set("auth", { session, user });
      if (session.fresh) {
        const freshSessionCookie = lucia.createSessionCookie(session.id);
        c.header("Set-Cookie", freshSessionCookie.serialize(), { append: true });
      }
    } else {
      const blankSessionCookie = lucia.createBlankSessionCookie();
      c.header("Set-Cookie", blankSessionCookie.serialize(), { append: true });
    }
  }

  await next();
};
