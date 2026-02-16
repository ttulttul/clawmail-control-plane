import { describe, expect, test } from "vitest";

import { getAuthSubmitDisabledReason } from "../src/lib/auth-form";

describe("getAuthSubmitDisabledReason", () => {
  test("requires email for login", () => {
    expect(
      getAuthSubmitDisabledReason("login", {
        email: "",
        password: "secret",
        riskName: "",
      }),
    ).toBe("Enter your email address.");
  });

  test("requires password for login", () => {
    expect(
      getAuthSubmitDisabledReason("login", {
        email: "ops@example.com",
        password: "",
        riskName: "",
      }),
    ).toBe("Enter your password.");
  });

  test("requires stronger constraints for register mode", () => {
    expect(
      getAuthSubmitDisabledReason("register", {
        email: "ops@example.com",
        password: "short",
        riskName: "",
      }),
    ).toBe("Use a password with at least 12 characters.");
  });

  test("requires risk name for register mode", () => {
    expect(
      getAuthSubmitDisabledReason("register", {
        email: "ops@example.com",
        password: "long-enough-password",
        riskName: "a",
      }),
    ).toBe("Enter a risk name with at least 2 characters.");
  });

  test("returns null when fields are valid", () => {
    expect(
      getAuthSubmitDisabledReason("register", {
        email: "ops@example.com",
        password: "long-enough-password",
        riskName: "acme",
      }),
    ).toBeNull();
  });
});
