import { useState } from "react";

import { formatAuthErrorMessage } from "../lib/auth-errors";
import { trpc } from "../lib/trpc";

export function AuthGate() {
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantName, setTenantName] = useState("");
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

  const authError = login.error?.message ?? register.error?.message ?? null;
  const authErrorMessages = authError ? formatAuthErrorMessage(authError) : [];

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
}
