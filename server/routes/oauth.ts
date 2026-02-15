import {
  ArcticFetchError,
  GitHub,
  Google,
  OAuth2RequestError,
  UnexpectedResponseError,
  generateCodeVerifier,
  generateState,
} from "arctic";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";

import { lucia } from "../auth/lucia.js";
import { db } from "../lib/db.js";
import { env } from "../lib/env.js";
import {
  OAuthFlowError,
  linkOAuthAccount,
  normalizePostAuthPath,
  parseGitHubIdentity,
  parseGoogleIdentity,
  type OAuthIdentity,
  type OAuthProvider,
} from "../services/oauth-service.js";
import type { AppVariables } from "../types/hono.js";

const oauthProviderSchema = z.enum(["github", "google"]);

const oauthCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

const oauthCookieNames = {
  state: "oauth_state",
  codeVerifier: "oauth_code_verifier",
  provider: "oauth_provider",
  nextPath: "oauth_next_path",
} as const;

const oauthStateMaxAgeSeconds = 60 * 10;

const githubScopes = ["read:user", "user:email"] as const;
const googleScopes = ["openid", "profile", "email"] as const;

export const oauthRouter = new Hono<{ Variables: AppVariables }>();

oauthRouter.get("/:provider/start", async (c) => {
  const parsedProvider = oauthProviderSchema.safeParse(c.req.param("provider"));
  const provider = parsedProvider.success ? parsedProvider.data : null;
  const nextPath = normalizePostAuthPath(c.req.query("next"));

  if (!provider) {
    return c.redirect(toAuthErrorPath(nextPath, "oauth_provider_invalid"), 302);
  }

  const callbackUrl = getProviderCallbackUrl(c, provider);
  const state = generateState();

  setOAuthCookie(c, oauthCookieNames.state, state);
  setOAuthCookie(c, oauthCookieNames.provider, provider);
  setOAuthCookie(c, oauthCookieNames.nextPath, nextPath);

  if (provider === "google") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      clearOAuthCookies(c);
      return c.redirect(toAuthErrorPath(nextPath, "oauth_provider_not_configured"), 302);
    }

    const codeVerifier = generateCodeVerifier();
    setOAuthCookie(c, oauthCookieNames.codeVerifier, codeVerifier);

    const google = new Google(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      callbackUrl,
    );

    const authorizationUrl = google.createAuthorizationURL(
      state,
      codeVerifier,
      [...googleScopes],
    );
    authorizationUrl.searchParams.set("prompt", "select_account");

    return c.redirect(authorizationUrl.toString(), 302);
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    clearOAuthCookies(c);
    return c.redirect(toAuthErrorPath(nextPath, "oauth_provider_not_configured"), 302);
  }

  deleteCookie(c, oauthCookieNames.codeVerifier, { path: "/" });

  const github = new GitHub(
    env.GITHUB_CLIENT_ID,
    env.GITHUB_CLIENT_SECRET,
    callbackUrl,
  );

  const authorizationUrl = github.createAuthorizationURL(state, [...githubScopes]);

  return c.redirect(authorizationUrl.toString(), 302);
});

oauthRouter.get("/:provider/callback", async (c) => {
  const nextPath = normalizePostAuthPath(getCookie(c, oauthCookieNames.nextPath));

  const parsedProvider = oauthProviderSchema.safeParse(c.req.param("provider"));
  if (!parsedProvider.success) {
    clearOAuthCookies(c);
    return c.redirect(toAuthErrorPath(nextPath, "oauth_provider_invalid"), 302);
  }

  const provider = parsedProvider.data;

  const parsedQuery = oauthCallbackQuerySchema.safeParse({
    code: c.req.query("code"),
    state: c.req.query("state"),
  });

  if (!parsedQuery.success) {
    clearOAuthCookies(c);
    return c.redirect(toAuthErrorPath(nextPath, "oauth_callback_missing_params"), 302);
  }

  const storedState = getCookie(c, oauthCookieNames.state);
  const storedProvider = getCookie(c, oauthCookieNames.provider);
  const codeVerifier = getCookie(c, oauthCookieNames.codeVerifier);

  clearOAuthCookies(c);

  if (!storedState || storedState !== parsedQuery.data.state) {
    return c.redirect(toAuthErrorPath(nextPath, "oauth_state_mismatch"), 302);
  }

  if (!storedProvider || storedProvider !== provider) {
    return c.redirect(toAuthErrorPath(nextPath, "oauth_provider_mismatch"), 302);
  }

  try {
    const callbackUrl = getProviderCallbackUrl(c, provider);
    const identity = await getOAuthIdentity({
      provider,
      code: parsedQuery.data.code,
      codeVerifier,
      callbackUrl,
    });

    const user = await linkOAuthAccount(db, {
      provider,
      providerUserId: identity.providerUserId,
      email: identity.email,
    });

    const session = await lucia.createSession(user.userId, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    c.header("Set-Cookie", sessionCookie.serialize(), { append: true });

    return c.redirect(nextPath, 302);
  } catch (error) {
    c.get("logger").warn("OAuth callback failed", {
      provider,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return c.redirect(toAuthErrorPath(nextPath, mapOAuthError(error)), 302);
  }
});

function getProviderCallbackUrl(
  c: Context<{ Variables: AppVariables }>,
  provider: OAuthProvider,
): string {
  const publicUrl = new URL(env.AUTH_PUBLIC_URL ?? new URL(c.req.url).origin);
  publicUrl.pathname = "/";
  publicUrl.search = "";
  publicUrl.hash = "";

  return new URL(`/auth/oauth/${provider}/callback`, publicUrl).toString();
}

function setOAuthCookie(
  c: Context<{ Variables: AppVariables }>,
  name: string,
  value: string,
): void {
  setCookie(c, name, value, {
    httpOnly: true,
    maxAge: oauthStateMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
  });
}

function clearOAuthCookies(
  c: Context<{ Variables: AppVariables }>,
): void {
  deleteCookie(c, oauthCookieNames.state, { path: "/" });
  deleteCookie(c, oauthCookieNames.provider, { path: "/" });
  deleteCookie(c, oauthCookieNames.codeVerifier, { path: "/" });
  deleteCookie(c, oauthCookieNames.nextPath, { path: "/" });
}

function toAuthErrorPath(nextPath: string, errorCode: string): string {
  const url = new URL(nextPath, "http://localhost");
  url.searchParams.set("authError", errorCode);

  return `${url.pathname}${url.search}${url.hash}`;
}

async function getOAuthIdentity(input: {
  provider: OAuthProvider;
  code: string;
  codeVerifier: string | undefined;
  callbackUrl: string;
}): Promise<OAuthIdentity> {
  if (input.provider === "google") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new OAuthFlowError(
        "OAUTH_INVALID_PROFILE",
        "Google OAuth credentials are not configured.",
      );
    }

    if (!input.codeVerifier) {
      throw new OAuthFlowError(
        "OAUTH_INVALID_PROFILE",
        "OAuth code verifier is missing.",
      );
    }

    const google = new Google(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      input.callbackUrl,
    );

    const tokens = await google.validateAuthorizationCode(
      input.code,
      input.codeVerifier,
    );

    const profileResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken()}`,
        },
      },
    );

    if (!profileResponse.ok) {
      throw new OAuthFlowError(
        "OAUTH_INVALID_PROFILE",
        "Google user profile request failed.",
      );
    }

    const profilePayload = await profileResponse.json();
    return parseGoogleIdentity(profilePayload);
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    throw new OAuthFlowError(
      "OAUTH_INVALID_PROFILE",
      "GitHub OAuth credentials are not configured.",
    );
  }

  const github = new GitHub(
    env.GITHUB_CLIENT_ID,
    env.GITHUB_CLIENT_SECRET,
    input.callbackUrl,
  );

  const tokens = await github.validateAuthorizationCode(input.code);

  const githubHeaders = {
    Authorization: `Bearer ${tokens.accessToken()}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "clawmail-control-plane",
  };

  const [userResponse, emailsResponse] = await Promise.all([
    fetch("https://api.github.com/user", {
      headers: githubHeaders,
    }),
    fetch("https://api.github.com/user/emails", {
      headers: githubHeaders,
    }),
  ]);

  if (!userResponse.ok) {
    throw new OAuthFlowError(
      "OAUTH_INVALID_PROFILE",
      "GitHub user profile request failed.",
    );
  }

  const userPayload = await userResponse.json();
  const emailsPayload = emailsResponse.ok ? await emailsResponse.json() : null;

  return parseGitHubIdentity(userPayload, emailsPayload);
}

function mapOAuthError(error: unknown): string {
  if (error instanceof OAuthFlowError) {
    switch (error.code) {
      case "OAUTH_EMAIL_NOT_VERIFIED":
        return "oauth_email_not_verified";
      case "OAUTH_EMAIL_UNAVAILABLE":
        return "oauth_email_unavailable";
      case "OAUTH_PROVIDER_ACCOUNT_CONFLICT":
        return "oauth_provider_account_conflict";
      case "OAUTH_INVALID_PROFILE":
      default:
        return "oauth_invalid_profile";
    }
  }

  if (
    error instanceof OAuth2RequestError ||
    error instanceof ArcticFetchError ||
    error instanceof UnexpectedResponseError
  ) {
    return "oauth_exchange_failed";
  }

  return "oauth_callback_failed";
}
