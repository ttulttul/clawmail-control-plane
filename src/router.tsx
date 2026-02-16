import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

import { AppLayout } from "./components/app-layout";
import { AuditRoute } from "./routes/audit";
import { DashboardRoute } from "./routes/dashboard";
import { DomainsRoute } from "./routes/domains";
import { InstancesRoute } from "./routes/instances";
import { RisksRoute } from "./routes/risks";
import { WebhooksRoute } from "./routes/webhooks";

const rootRoute = createRootRoute({
  component: AppLayout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardRoute,
});

const risksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/risks",
  component: RisksRoute,
});

const instancesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/instances",
  component: InstancesRoute,
});

const domainsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/domains",
  component: DomainsRoute,
});

const webhooksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/webhooks",
  component: WebhooksRoute,
});

const auditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/audit",
  component: AuditRoute,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  risksRoute,
  instancesRoute,
  domainsRoute,
  webhooksRoute,
  auditRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
