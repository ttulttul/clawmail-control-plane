/* @vitest-environment node */

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { oauthAccounts, users } from "../drizzle/schema";

interface LoadedModules {
  db: (typeof import("../server/lib/db"))["db"];
  closeDatabase: (typeof import("../server/lib/db"))["closeDatabase"];
  OAuthFlowError: (typeof import("../server/services/oauth-service"))["OAuthFlowError"];
  linkOAuthAccount: (typeof import("../server/services/oauth-service"))["linkOAuthAccount"];
  normalizePostAuthPath: (typeof import("../server/services/oauth-service"))["normalizePostAuthPath"];
  parseGoogleIdentity: (typeof import("../server/services/oauth-service"))["parseGoogleIdentity"];
  selectGitHubVerifiedEmail: (typeof import("../server/services/oauth-service"))["selectGitHubVerifiedEmail"];
}

let modules: LoadedModules;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = join(
    tmpdir(),
    `clawmail-oauth-test-${Date.now()}-${randomUUID()}.db`,
  );

  const [dbModule, oauthServiceModule] = await Promise.all([
    import("../server/lib/db"),
    import("../server/services/oauth-service"),
  ]);

  modules = {
    db: dbModule.db,
    closeDatabase: dbModule.closeDatabase,
    OAuthFlowError: oauthServiceModule.OAuthFlowError,
    linkOAuthAccount: oauthServiceModule.linkOAuthAccount,
    normalizePostAuthPath: oauthServiceModule.normalizePostAuthPath,
    parseGoogleIdentity: oauthServiceModule.parseGoogleIdentity,
    selectGitHubVerifiedEmail: oauthServiceModule.selectGitHubVerifiedEmail,
  };
});

afterAll(() => {
  modules.closeDatabase();
});

describe("oauth-service", () => {
  test("normalizes post-auth redirect paths", () => {
    expect(modules.normalizePostAuthPath(undefined)).toBe("/");
    expect(modules.normalizePostAuthPath("https://example.com")).toBe("/");
    expect(modules.normalizePostAuthPath("//evil.example")).toBe("/");
    expect(modules.normalizePostAuthPath("/tenants?tab=settings")).toBe(
      "/tenants?tab=settings",
    );
  });

  test("picks a verified GitHub email", () => {
    const email = modules.selectGitHubVerifiedEmail([
      { email: "secondary@example.com", verified: true, primary: false },
      { email: "primary@example.com", verified: true, primary: true },
    ]);

    expect(email).toBe("primary@example.com");
  });

  test("rejects Google identities with unverified email", () => {
    expect(() =>
      modules.parseGoogleIdentity({
        sub: "google-user-1",
        email: "user@example.com",
        email_verified: false,
      }),
    ).toThrowError(modules.OAuthFlowError);
  });

  test("links oauth account to existing email user", async () => {
    const userId = randomUUID();
    const email = `local-${Date.now()}-${randomUUID()}@example.com`;

    await modules.db.insert(users).values({
      id: userId,
      email,
      passwordHash: "existing-password-hash",
    });

    const linked = await modules.linkOAuthAccount(modules.db, {
      provider: "github",
      providerUserId: `gh-${randomUUID()}`,
      email: email.toUpperCase(),
    });

    expect(linked.userId).toBe(userId);

    const providerRecord = await modules.db.query.oauthAccounts.findFirst({
      where: eq(oauthAccounts.userId, userId),
    });

    expect(providerRecord?.provider).toBe("github");
    expect(providerRecord?.providerUserId.startsWith("gh-")).toBe(true);
  });

  test("creates sso-only user when no local user exists", async () => {
    const providerUserId = `google-${randomUUID()}`;
    const email = `sso-${Date.now()}-${randomUUID()}@example.com`;

    const linked = await modules.linkOAuthAccount(modules.db, {
      provider: "google",
      providerUserId,
      email,
    });

    const storedUser = await modules.db.query.users.findFirst({
      where: eq(users.id, linked.userId),
    });
    const providerRecord = await modules.db.query.oauthAccounts.findFirst({
      where: eq(oauthAccounts.providerUserId, providerUserId),
    });

    expect(storedUser?.email).toBe(email.toLowerCase());
    expect(storedUser?.passwordHash).toBeNull();
    expect(providerRecord?.userId).toBe(linked.userId);
  });
});
