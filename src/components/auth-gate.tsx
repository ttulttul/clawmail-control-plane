import { useMemo, useState } from "react";

import { trpc } from "../lib/trpc";

type OAuthProvider = "github" | "google";

const oauthErrorMessages: Record<string, string> = {
  oauth_provider_not_configured:
    "Single sign-on is not configured for this provider.",
  oauth_state_mismatch: "Sign-in session expired. Please try again.",
  oauth_provider_mismatch: "Sign-in provider did not match. Please try again.",
  oauth_exchange_failed:
    "Could not complete OAuth exchange with the provider. Please try again.",
  oauth_email_not_verified:
    "Your Google account email must be verified before signing in.",
  oauth_email_unavailable:
    "GitHub did not provide a verified email address for this account.",
  oauth_provider_account_conflict:
    "This email is already linked to a different account for this provider.",
  oauth_callback_missing_params: "Sign-in response was missing required fields.",
  oauth_provider_invalid: "Invalid OAuth provider requested.",
  oauth_invalid_profile:
    "We could not validate your provider profile. Please try again.",
  oauth_callback_failed: "SSO sign-in failed. Please try again.",
};

export function AuthGate() {
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantName, setTenantName] = useState("");
  const oauthErrorMessage = useMemo(() => {
    const authError = new URLSearchParams(window.location.search).get("authError");
    if (!authError) {
      return null;
    }

    return oauthErrorMessages[authError] ?? "SSO sign-in failed. Please try again.";
  }, []);

  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      await utils.tenants.list.invalidate();
    },
  });

  const register = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      await utils.tenants.list.invalidate();
    },
  });

  const launchOAuthLogin = (provider: OAuthProvider): void => {
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.delete("authError");
    const cleanSearch = searchParams.toString();
    const nextPath = cleanSearch
      ? `${window.location.pathname}?${cleanSearch}`
      : window.location.pathname;

    const oauthStartUrl = new URL(
      `/auth/oauth/${provider}/start`,
      window.location.origin,
    );
    oauthStartUrl.searchParams.set("next", nextPath);
    window.location.assign(oauthStartUrl.toString());
  };

  const errorMessage =
    login.error?.message ?? register.error?.message ?? oauthErrorMessage;

  return (
    <section className="auth-panel">
      <h1>ClawMail Control Plane</h1>
      <p>Sign in to manage tenant provisioning, limits, and gateway operations.</p>
      <div className="button-row">
        <button
          type="button"
          className="sso-button"
          onClick={() => launchOAuthLogin("google")}
        >
          Continue with Google
        </button>
        <button
          type="button"
          className="sso-button"
          onClick={() => launchOAuthLogin("github")}
        >
          Continue with GitHub
        </button>
      </div>
      <p className="muted-text">Or use your local email and password account.</p>
      <div className="form-grid">
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label>
          Tenant (for register)
          <input
            value={tenantName}
            onChange={(event) => setTenantName(event.target.value)}
          />
        </label>
      </div>
      <div className="button-row">
        <button
          disabled={login.isPending}
          onClick={() => login.mutate({ email, password })}
          type="button"
        >
          Login
        </button>
        <button
          disabled={register.isPending}
          onClick={() => register.mutate({ email, password, tenantName })}
          type="button"
        >
          Register
        </button>
      </div>
      {errorMessage && <p className="error-message">{errorMessage}</p>}
    </section>
  );
}
