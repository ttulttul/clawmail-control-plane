/* @vitest-environment node */

import { TRPCError } from "@trpc/server";
import { describe, expect, test } from "vitest";

import { ProviderHttpError } from "../server/connectors/provider-error";
import {
  mapProviderError,
  withProviderErrorMapping,
} from "../server/services/provider-error-mapper";

function buildProviderError(status: number): ProviderHttpError {
  return new ProviderHttpError({
    provider: "mailchannels",
    status,
    path: "/send",
    body: `status=${status}`,
  });
}

describe("provider-error-mapper", () => {
  test("maps provider status codes to meaningful TRPCError codes", () => {
    const cases: Array<{
      status: number;
      expectedCode:
        | "BAD_REQUEST"
        | "UNAUTHORIZED"
        | "CONFLICT"
        | "TOO_MANY_REQUESTS";
    }> = [
      { status: 400, expectedCode: "BAD_REQUEST" },
      { status: 401, expectedCode: "UNAUTHORIZED" },
      { status: 409, expectedCode: "CONFLICT" },
      { status: 429, expectedCode: "TOO_MANY_REQUESTS" },
    ];

    for (const item of cases) {
      try {
        mapProviderError(buildProviderError(item.status), "Provider call failed");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe(item.expectedCode);
        }
      }
    }
  });

  test("falls back to INTERNAL_SERVER_ERROR for unknown errors", async () => {
    await expect(
      withProviderErrorMapping(async () => {
        throw new Error("boom");
      }, "Unexpected provider failure"),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});
