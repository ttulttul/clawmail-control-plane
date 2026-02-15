import { describe, expect, test } from "vitest";

import { getAuthSubmitDisabledReason } from "../src/lib/auth-form";

describe("getAuthSubmitDisabledReason", () => {
  test("requires email for login", () => {
    expect(
      getAuthSubmitDisabledReason("login", {
        email: "",
        password: "secret",
        tenantName: "",
      }),
    ).toBe("Enter your email address.");
  });

  test("requires password for login", () => {
    expect(
      getAuthSubmitDisabledReason("login", {
        email: "ops@example.com",
        password: "",
        tenantName: "",
      }),
    ).toBe("Enter your password.");
  });

  test("requires stronger constraints for register mode", () => {
    expect(
      getAuthSubmitDisabledReason("register", {
        email: "ops@example.com",
        password: "short",
        tenantName: "",
      }),
    ).toBe("Use a password with at least 12 characters.");
  });

  test("requires tenant name for register mode", () => {
    expect(
      getAuthSubmitDisabledReason("register", {
        email: "ops@example.com",
        password: "long-enough-password",
        tenantName: "a",
      }),
    ).toBe("Enter a tenant name with at least 2 characters.");
  });

  test("returns null when fields are valid", () => {
    expect(
      getAuthSubmitDisabledReason("register", {
        email: "ops@example.com",
        password: "long-enough-password",
        tenantName: "acme",
      }),
    ).toBeNull();
  });
});
