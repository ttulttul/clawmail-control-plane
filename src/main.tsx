import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { router } from "./router";
import { trpc, trpcClient } from "./lib/trpc";
import { ActiveRiskProvider } from "./hooks/use-active-risk";
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
        <ActiveRiskProvider>
          <RouterProvider router={router} />
        </ActiveRiskProvider>
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
);
