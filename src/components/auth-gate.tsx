import { useState } from "react";

import { trpc } from "../lib/trpc";

export function AuthGate() {
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantName, setTenantName] = useState("");

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

  return (
    <section className="auth-panel">
      <h1>ClawMail Control Plane</h1>
      <p>Sign in to manage tenant provisioning, limits, and gateway operations.</p>
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
      {(login.error || register.error) && (
        <p className="error-message">
          {login.error?.message ?? register.error?.message}
        </p>
      )}
    </section>
  );
}
