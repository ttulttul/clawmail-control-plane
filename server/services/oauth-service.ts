import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { oauthAccounts, users } from "../../drizzle/schema.js";
import type { DatabaseClient } from "../lib/db.js";
import { createId } from "../lib/id.js";

export type OAuthProvider = "github" | "google";

export type OAuthFlowErrorCode =
  | "OAUTH_INVALID_PROFILE"
  | "OAUTH_EMAIL_UNAVAILABLE"
  | "OAUTH_EMAIL_NOT_VERIFIED"
  | "OAUTH_PROVIDER_ACCOUNT_CONFLICT";

export class OAuthFlowError extends Error {
  readonly code: OAuthFlowErrorCode;

  constructor(code: OAuthFlowErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "OAuthFlowError";
  }
}

export interface OAuthIdentity {
  providerUserId: string;
  email: string;
}

export function normalizePostAuthPath(rawPath: string | null | undefined): string {
  if (!rawPath) {
    return "/";
  }

  if (!rawPath.startsWith("/") || rawPath.startsWith("//")) {
    return "/";
  }

  return rawPath;
}

const githubUserSchema = z.object({
  id: z.number().int(),
  email: z.string().email().nullable(),
});

const githubEmailsSchema = z.array(
  z.object({
    email: z.string().email(),
    verified: z.boolean(),
    primary: z.boolean(),
  }),
);

const googleProfileSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((value) => value === true || value === "true"),
});

export function selectGitHubVerifiedEmail(rawEmails: unknown): string | null {
  const parsed = githubEmailsSchema.safeParse(rawEmails);
  if (!parsed.success) {
    return null;
  }

  const preferred =
    parsed.data.find((entry) => entry.primary && entry.verified) ??
    parsed.data.find((entry) => entry.verified);

  return preferred ? preferred.email.toLowerCase() : null;
}

export function parseGitHubIdentity(
  rawUser: unknown,
  rawEmails: unknown,
): OAuthIdentity {
  const parsedUser = githubUserSchema.safeParse(rawUser);
  if (!parsedUser.success) {
    throw new OAuthFlowError(
      "OAUTH_INVALID_PROFILE",
      "GitHub profile response did not include expected fields.",
    );
  }

  const verifiedEmail = selectGitHubVerifiedEmail(rawEmails);
  const email = verifiedEmail ?? parsedUser.data.email?.toLowerCase() ?? null;

  if (!email) {
    throw new OAuthFlowError(
      "OAUTH_EMAIL_UNAVAILABLE",
      "GitHub account does not expose a verified email address.",
    );
  }

  return {
    providerUserId: String(parsedUser.data.id),
    email,
  };
}

export function parseGoogleIdentity(rawProfile: unknown): OAuthIdentity {
  const parsedProfile = googleProfileSchema.safeParse(rawProfile);
  if (!parsedProfile.success) {
    throw new OAuthFlowError(
      "OAUTH_INVALID_PROFILE",
      "Google profile response did not include expected fields.",
    );
  }

  if (!parsedProfile.data.email_verified) {
    throw new OAuthFlowError(
      "OAUTH_EMAIL_NOT_VERIFIED",
      "Google account email must be verified.",
    );
  }

  return {
    providerUserId: parsedProfile.data.sub,
    email: parsedProfile.data.email.toLowerCase(),
  };
}

export async function linkOAuthAccount(
  db: DatabaseClient,
  input: {
    provider: OAuthProvider;
    providerUserId: string;
    email: string;
  },
): Promise<{ userId: string }> {
  const normalizedEmail = input.email.toLowerCase();

  const existingAccount = await db.query.oauthAccounts.findFirst({
    where: and(
      eq(oauthAccounts.provider, input.provider),
      eq(oauthAccounts.providerUserId, input.providerUserId),
    ),
  });

  if (existingAccount) {
    return { userId: existingAccount.userId };
  }

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });

  let userId = existingUser?.id;
  if (!userId) {
    userId = createId();
    await db.insert(users).values({
      id: userId,
      email: normalizedEmail,
      passwordHash: null,
    });
  }

  const accountForUser = await db.query.oauthAccounts.findFirst({
    where: and(
      eq(oauthAccounts.provider, input.provider),
      eq(oauthAccounts.userId, userId),
    ),
  });

  if (accountForUser?.providerUserId === input.providerUserId) {
    return { userId };
  }

  if (accountForUser && accountForUser.providerUserId !== input.providerUserId) {
    throw new OAuthFlowError(
      "OAUTH_PROVIDER_ACCOUNT_CONFLICT",
      "This email is already linked to a different account for this provider.",
    );
  }

  await db.insert(oauthAccounts).values({
    id: createId(),
    userId,
    provider: input.provider,
    providerUserId: input.providerUserId,
  });

  return { userId };
}
