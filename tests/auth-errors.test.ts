import { describe, expect, test } from "vitest";

import { formatAuthErrorMessage } from "../src/lib/auth-errors";

describe("formatAuthErrorMessage", () => {
  test("returns a plain message when payload is not json", () => {
    expect(formatAuthErrorMessage("Login failed")).toEqual(["Login failed"]);
  });

  test("parses serialized zod issues", () => {
    const message = JSON.stringify([
      {
        code: "too_small",
        minimum: 12,
        type: "string",
        message: "String must contain at least 12 character(s)",
        path: ["password"],
      },
      {
        code: "too_small",
        minimum: 2,
        type: "string",
        message: "String must contain at least 2 character(s)",
        path: ["castName"],
      },
    ]);

    expect(formatAuthErrorMessage(message)).toEqual([
      "password: String must contain at least 12 character(s)",
      "castName: String must contain at least 2 character(s)",
    ]);
  });

  test("falls back to generic text on empty input", () => {
    expect(formatAuthErrorMessage("   ")).toEqual([
      "Something went wrong while processing this request.",
    ]);
  });
});
