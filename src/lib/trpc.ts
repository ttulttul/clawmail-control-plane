import { createTRPCReact } from "@trpc/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

import type { AppRouter } from "../../server/routers/_app.js";

export const trpc = createTRPCReact<AppRouter>();

function resolveApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return "http://localhost:3000";
  }

  return window.location.origin;
}

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${resolveApiBaseUrl()}/trpc`,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});
