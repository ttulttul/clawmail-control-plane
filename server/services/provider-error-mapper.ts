import { TRPCError } from "@trpc/server";

import { ProviderHttpError } from "../connectors/provider-error.js";

function mapStatusToCode(status: number):
  | "BAD_REQUEST"
  | "CONFLICT"
  | "FORBIDDEN"
  | "INTERNAL_SERVER_ERROR"
  | "NOT_FOUND"
  | "TOO_MANY_REQUESTS"
  | "UNAUTHORIZED" {
  if (status === 400) {
    return "BAD_REQUEST";
  }

  if (status === 401) {
    return "UNAUTHORIZED";
  }

  if (status === 403) {
    return "FORBIDDEN";
  }

  if (status === 404) {
    return "NOT_FOUND";
  }

  if (status === 409) {
    return "CONFLICT";
  }

  if (status === 429) {
    return "TOO_MANY_REQUESTS";
  }

  return "INTERNAL_SERVER_ERROR";
}

function buildProviderMessage(error: ProviderHttpError, contextMessage: string): string {
  const bodySnippet = error.body.trim().slice(0, 180);
  if (bodySnippet.length === 0) {
    return `${contextMessage} (${error.provider} ${error.status})`;
  }

  return `${contextMessage} (${error.provider} ${error.status}): ${bodySnippet}`;
}

export function mapProviderError(error: unknown, contextMessage: string): never {
  if (error instanceof TRPCError) {
    throw error;
  }

  if (error instanceof ProviderHttpError) {
    throw new TRPCError({
      code: mapStatusToCode(error.status),
      message: buildProviderMessage(error, contextMessage),
      cause: error,
    });
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: contextMessage,
    cause: error,
  });
}

export async function withProviderErrorMapping<T>(
  operation: () => Promise<T>,
  contextMessage: string,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    mapProviderError(error, contextMessage);
  }
}
