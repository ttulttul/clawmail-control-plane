import { useMemo, useState } from "react";

import { formatAuthErrorMessage } from "../lib/auth-errors";
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
  const [showPassword, setShowPassword] = useState(false);

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

  // Merge error sources: login, register, or oauth params
  const rawAuthError =
    login.error?.message ?? register.error?.message ?? oauthErrorMessage ?? null;
  const authErrorMessages = rawAuthError ? formatAuthErrorMessage(rawAuthError) : [];

  return (
    <section className="auth-shell">
      <header className="auth-brand-strip">
        <div className="auth-brand-inner">
          <div className="brand-mark" aria-hidden="true">
            CM
          </div>
          <div>
            <p className="brand-title">ClawMail</p>
            <p className="brand-subtitle">Control Plane</p>
          </div>
        </div>
      </header>

      <div className="auth-stage">
        <article className="auth-card">
          <div className="auth-orb" aria-hidden="true">
            CM
          </div>
          <p className="auth-kicker">Secure Access</p>
          <h1>Log in to your workspace</h1>
          <p className="muted-copy">
            Manage tenant provisioning, limits, webhook delivery, and agent gateway
            operations.
          </p>

          {/* SSO Buttons injected here */}
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
          <p className="muted-text" style={{ textAlign: "center", margin: "1rem 0" }}>
            Or use your local email and password account.
          </p>

          <div className="auth-form">
            <label>
              Email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <div className="input-with-action">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                />
                <button
                  className="auth-eye-toggle"
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <label>
              Tenant name (register only)
              <input
                value={tenantName}
                onChange={(event) => setTenantName(event.target.value)}
                placeholder="acme-mail"
              />
            </label>
          </div>

          <div className="button-row">
            <button
              disabled={login.isPending}
              onClick={() => login.mutate({ email, password })}
              type="button"
            >
              {login.isPending ? "Logging in..." : "Log In"}
            </button>
            <button
              className="button-secondary"
              disabled={register.isPending}
              onClick={() => register.mutate({ email, password, tenantName })}
              type="button"
            >
              {register.isPending ? "Registering..." : "Register"}
            </button>
          </div>

          <p className="auth-footer">
            New workspace setup: register with a tenant name, then configure providers from
            the Tenants page.
          </p>

          {authErrorMessages.length > 0 && (
            <div className="error-box" role="alert">
              <p>Request failed:</p>
              <ul className="error-list">
                {authErrorMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}
        </article>
      </div>
    </section>
  );
    </section>
  );
}
