import { useMemo, useState } from "react";

import { formatAuthErrorMessage } from "../lib/auth-errors";
import {
  type AuthMode,
  getAuthSubmitDisabledReason,
} from "../lib/auth-form";
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

function readOAuthError(): string | null {
  const authErrorCode = new URLSearchParams(window.location.search).get("authError");
  if (!authErrorCode) {
    return null;
  }

  return oauthErrorMessages[authErrorCode] ?? "SSO sign-in failed. Please try again.";
}

function removeOAuthErrorFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("authError");
  const nextValue = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(null, "", nextValue);
}

function launchOAuthLogin(provider: OAuthProvider): void {
  removeOAuthErrorFromUrl();
  const oauthStartUrl = new URL(`/auth/oauth/${provider}/start`, window.location.origin);
  oauthStartUrl.searchParams.set(
    "next",
    `${window.location.pathname}${window.location.search}`,
  );
  window.location.assign(oauthStartUrl.toString());
}

export function AuthGate() {
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [riskName, setRiskName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [oauthErrorMessage, setOauthErrorMessage] = useState<string | null>(() =>
    readOAuthError(),
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const login = trpc.auth.login.useMutation({
    onMutate: () => {
      setSuccessMessage(null);
    },
    onSuccess: async () => {
      setSuccessMessage("Signed in successfully. Redirecting to your workspace...");
      await utils.auth.me.invalidate();
      await utils.risks.list.invalidate();
    },
  });

  const register = trpc.auth.register.useMutation({
    onMutate: () => {
      setSuccessMessage(null);
    },
    onSuccess: async (_, input) => {
      const riskLabel =
        input.riskName && input.riskName.trim().length > 0
          ? ` and created risk "${input.riskName.trim()}"`
          : "";
      setSuccessMessage(`Account created${riskLabel}. Redirecting to your workspace...`);
      await utils.auth.me.invalidate();
      await utils.risks.list.invalidate();
    },
  });

  const submitDisabledReason = getAuthSubmitDisabledReason(mode, {
    email,
    password,
    riskName,
  });
  const isSubmitting = login.isPending || register.isPending;
  const pendingMessage = login.isPending
    ? "Signing in..."
    : register.isPending
      ? "Creating account..."
      : null;

  const rawAuthError =
    login.error?.message ?? register.error?.message ?? oauthErrorMessage ?? null;
  const authErrorMessages = useMemo(
    () => (rawAuthError ? formatAuthErrorMessage(rawAuthError) : []),
    [rawAuthError],
  );

  function submitAuthForm(): void {
    if (submitDisabledReason) {
      return;
    }

    removeOAuthErrorFromUrl();
    setOauthErrorMessage(null);

    if (mode === "login") {
      login.mutate({ email: email.trim(), password });
      return;
    }

    register.mutate({
      email: email.trim(),
      password,
      riskName: riskName.trim(),
    });
  }

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
          <h1>Access your workspace</h1>
          <p className="muted-copy">
            Operate risks, monitor delivery, and manage agent gateway controls.
          </p>

          <div className="auth-sso-grid">
            <button
              type="button"
              className="sso-button"
              disabled={isSubmitting}
              onClick={() => launchOAuthLogin("google")}
            >
              Continue with Google
            </button>
            <button
              type="button"
              className="sso-button"
              disabled={isSubmitting}
              onClick={() => launchOAuthLogin("github")}
            >
              Continue with GitHub
            </button>
          </div>

          <p className="muted-text centered-text">Or use your local email and password.</p>

          <div
            className="mode-toggle"
            role="tablist"
            aria-label="Authentication mode"
          >
            <button
              type="button"
              role="tab"
              className={`mode-toggle-item ${mode === "login" ? "active" : ""}`}
              aria-selected={mode === "login"}
              onClick={() => setMode("login")}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              className={`mode-toggle-item ${mode === "register" ? "active" : ""}`}
              aria-selected={mode === "register"}
              onClick={() => setMode("register")}
            >
              Register
            </button>
          </div>

          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              submitAuthForm();
            }}
          >
            <label>
              Email
              <input
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <div className="input-with-action">
                <input
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={
                    mode === "register"
                      ? "Use at least 12 characters"
                      : "Enter your password"
                  }
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
            {mode === "register" && (
              <label>
                Risk name
                <input
                  value={riskName}
                  onChange={(event) => setRiskName(event.target.value)}
                  placeholder="acme-mail"
                />
              </label>
            )}
            {submitDisabledReason && (
              <p className="hint-message" role="status" aria-live="polite">
                {submitDisabledReason}
              </p>
            )}
            {pendingMessage && (
              <p className="status-pill info" role="status" aria-live="polite">
                {pendingMessage}
              </p>
            )}
            {successMessage && (
              <p className="status-pill success" role="status" aria-live="polite">
                {successMessage}
              </p>
            )}
            <button type="submit" disabled={isSubmitting || submitDisabledReason !== null}>
              {mode === "login"
                ? login.isPending
                  ? "Signing In..."
                  : "Sign In"
                : register.isPending
                  ? "Creating Account..."
                  : "Create Account"}
            </button>
          </form>

          {authErrorMessages.length > 0 && (
            <div className="error-box" role="alert">
              <p>We could not complete this request:</p>
              <ul className="error-list">
                {authErrorMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
              <div className="status-actions">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    removeOAuthErrorFromUrl();
                    setOauthErrorMessage(null);
                    login.reset();
                    register.reset();
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <p className="auth-footer">
            If you are new here, register your account first, then connect providers from
            the Risks page.
          </p>
        </article>
      </div>
    </section>
  );
}
