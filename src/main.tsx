import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { router } from "./router";
import { trpc, trpcClient } from "./lib/trpc";
import { ActiveTenantProvider } from "./hooks/use-active-tenant";
import "./styles.css";

const queryClient = new QueryClient();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ActiveTenantProvider>
          <RouterProvider router={router} />
        </ActiveTenantProvider>
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
);
