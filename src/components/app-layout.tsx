import { Link, Outlet } from "@tanstack/react-router";

import { AuthGate } from "./auth-gate";
import { TenantSelector } from "./tenant-selector";
import { useActiveTenant } from "../hooks/use-active-tenant";
import { trpc } from "../lib/trpc";

const navLinks = [
  { to: "/", label: "Dashboard" },
  { to: "/tenants", label: "Tenants" },
  { to: "/instances", label: "Instances" },
  { to: "/domains", label: "Domains" },
  { to: "/webhooks", label: "Webhooks" },
  { to: "/audit", label: "Audit" },
] as const;

export function AppLayout() {
  const session = trpc.auth.me.useQuery();
  const tenants = trpc.tenants.list.useQuery(undefined, {
    enabled: Boolean(session.data),
  });
  const { activeTenantId, setActiveTenantId } = useActiveTenant();

  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setActiveTenantId(null);
    },
  });

  if (session.isLoading) {
    return <div className="centered">Loading session...</div>;
  }

  if (!session.data) {
    return <AuthGate />;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ClawMail</p>
          <h1>Control Plane</h1>
        </div>
        <div className="topbar-actions">
          <TenantSelector
            tenants={tenants.data}
            activeTenantId={activeTenantId}
            setActiveTenantId={setActiveTenantId}
          />
          <button type="button" onClick={() => logout.mutate()}>
            Logout
          </button>
        </div>
      </header>
      <nav className="nav-tabs">
        {navLinks.map((item) => (
          <Link key={item.to} to={item.to} className="nav-link" activeProps={{ className: "nav-link active" }}>
            {item.label}
          </Link>
        ))}
      </nav>
      <main className="page-content">
        <Outlet />
      </main>
    </div>
  );
}
