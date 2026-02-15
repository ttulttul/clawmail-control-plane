import { createRouter } from "../trpc.js";
import { agentmailRouter } from "./agentmail.js";
import { authRouter } from "./auth.js";
import { instancesRouter } from "./instances.js";
import { logsRouter } from "./logs.js";
import { mailchannelsRouter } from "./mailchannels.js";
import { tenantsRouter } from "./tenants.js";

export const appRouter = createRouter({
  auth: authRouter,
  tenants: tenantsRouter,
  instances: instancesRouter,
  mailchannels: mailchannelsRouter,
  agentmail: agentmailRouter,
  logs: logsRouter,
});

export type AppRouter = typeof appRouter;
