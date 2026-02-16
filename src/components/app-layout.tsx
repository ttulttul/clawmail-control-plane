import { Link, Outlet, useRouterState } from "@tanstack/react-router";

import { AuthGate } from "./auth-gate";
import { RiskSelector } from "./risk-selector";
import { useActiveRisk } from "../hooks/use-active-risk";
import { trpc } from "../lib/trpc";

const navLinks = [
  { to: "/", label: "Overview" },
  { to: "/risks", label: "Risks" },
  { to: "/instances", label: "Instances" },
  { to: "/domains", label: "Domains" },
  { to: "/webhooks", label: "Webhooks" },
  { to: "/audit", label: "Audit" },
] as const;

function getUserLabel(email: string | null): string {
  if (!email) {
    return "Operator";
  }

  const [name] = email.split("@");
  return name.length > 0 ? name : "Operator";
}

export function AppLayout() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const session = trpc.auth.me.useQuery();
  const risks = trpc.risks.list.useQuery(undefined, {
    enabled: Boolean(session.data),
  });
  const { activeRiskId, setActiveRiskId } = useActiveRisk();

  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setActiveRiskId(null);
    },
  });

  if (session.isLoading) {
    return <div className="centered">Loading session...</div>;
  }

  if (!session.data) {
    return <AuthGate />;
  }

  const activePage = navLinks.find((item) => item.to === path)?.label ?? "Control Plane";
  const userLabel = getUserLabel(session.data.email);
  const userInitial = userLabel.slice(0, 1).toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark" aria-hidden="true">
            CM
          </div>
          <div>
            <p className="brand-title">ClawMail</p>
            <p className="brand-subtitle">Mail Operations</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="sidebar-link"
              activeOptions={{ exact: item.to === "/" }}
              activeProps={{ className: "sidebar-link active" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip" aria-hidden="true">
            {userInitial}
          </div>
          <div className="sidebar-user-meta">
            <p>{userLabel}</p>
            <p>{session.data.email ?? "No email on profile"}</p>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Control Plane</p>
            <h1>{activePage}</h1>
          </div>
          <div className="workspace-actions">
            <RiskSelector
              risks={risks.data}
              activeRiskId={activeRiskId}
              setActiveRiskId={setActiveRiskId}
            />
            <button
              className="button-secondary"
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              {logout.isPending ? "Logging out..." : "Logout"}
            </button>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
