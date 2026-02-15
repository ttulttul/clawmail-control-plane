import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Hono } from "hono";

import { appRouter } from "./routers/_app.js";
import { requestContextMiddleware } from "./middleware/request-context.js";
import { requireAgentAuth } from "./middleware/agent-auth.js";
import type { AppVariables } from "./types/hono.js";
import { webhookRouter } from "./routes/webhooks.js";
import { oauthRouter } from "./routes/oauth.js";
import { agentRouter } from "./agent/routes.js";
import { env } from "./lib/env.js";
import { startJobScheduler } from "./jobs/scheduler.js";
import { db } from "./lib/db.js";

export const app = new Hono<{ Variables: AppVariables }>();

app.use("*", requestContextMiddleware);

app.onError((error, c) => {
  c.get("logger").error("Unhandled server error", {
    error: error.message,
  });

  return c.json(
    {
      error: "Internal server error.",
      requestId: c.get("requestId"),
    },
    500,
  );
});

app.get("/healthz", (c) => {
  return c.json({ ok: true, service: "clawmail-control-plane" });
});

app.get("/metrics", (c) => {
  return c.text("clawmail_requests_total 1\n", 200, {
    "content-type": "text/plain; version=0.0.4",
  });
});

app.all("/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: ({ resHeaders }) => ({
      db,
      logger: c.get("logger"),
      requestId: c.get("requestId"),
      auth: c.get("auth"),
      resHeaders,
    }),
  });
});

app.route("/webhooks", webhookRouter);
app.route("/auth/oauth", oauthRouter);
app.use("/agent/*", requireAgentAuth);
app.route("/agent", agentRouter);

if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist/client" }));
  app.get("*", serveStatic({ path: "./dist/client/index.html" }));
}

if (process.env.NODE_ENV !== "test") {
  startJobScheduler();
  serve({
    fetch: app.fetch,
    port: env.PORT,
  });
}
