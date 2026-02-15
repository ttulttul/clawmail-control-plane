import { useActiveTenant } from "../hooks/use-active-tenant";
import { trpc } from "../lib/trpc";

function formatTimestamp(value: string | number): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return String(value);
  }

  return timestamp.toLocaleString();
}

export function DashboardRoute() {
  const { activeTenantId } = useActiveTenant();

  const sends = trpc.logs.sends.useQuery(
    {
      tenantId: activeTenantId ?? "",
      limit: 10,
    },
    { enabled: Boolean(activeTenantId) },
  );

  const events = trpc.logs.events.useQuery(
    {
      tenantId: activeTenantId ?? "",
      limit: 10,
    },
    { enabled: Boolean(activeTenantId) },
  );

  const audit = trpc.logs.audit.useQuery(
    {
      tenantId: activeTenantId ?? "",
      limit: 10,
    },
    { enabled: Boolean(activeTenantId) },
  );

  if (!activeTenantId) {
    return (
      <section className="panel">
        <h2>Create a tenant to begin</h2>
        <p className="muted-copy">
          Pick a tenant from the selector or create one from the Tenants page to
          unlock dashboard metrics.
        </p>
      </section>
    );
  }

  const recentSends = sends.data ?? [];
  const recentEvents = events.data ?? [];
  const recentAudit = audit.data ?? [];

  return (
    <section className="dashboard-stack">
      <header className="overview-head">
        <h2>Overview</h2>
        <p className="muted-copy">
          Monitor deliverability, webhook traffic, and tenant-level operations.
        </p>
      </header>

      <div className="summary-grid">
        <article className="summary-card">
          <p className="summary-label">Recent Sends</p>
          <p className="metric">{recentSends.length}</p>
          <p className="metric-detail">
            {recentSends[0]
              ? `${recentSends[0].providerStatus} from ${recentSends[0].fromEmail}`
              : "No send activity in the latest sample."}
          </p>
        </article>

        <article className="summary-card">
          <p className="summary-label">Webhook Events</p>
          <p className="metric">{recentEvents.length}</p>
          <p className="metric-detail">
            {recentEvents[0]
              ? `${recentEvents[0].provider} ${recentEvents[0].eventType}`
              : "No webhook events captured yet."}
          </p>
        </article>

        <article className="summary-card">
          <p className="summary-label">Audit Actions</p>
          <p className="metric">{recentAudit.length}</p>
          <p className="metric-detail">
            {recentAudit[0]
              ? `Last action: ${recentAudit[0].action}`
              : "No audit actions recorded yet."}
          </p>
        </article>
      </div>

      <article className="panel">
        <div className="section-header">
          <h3>Latest Activity</h3>
          <p className="muted-copy">Most recent records from send, event, and audit feeds.</p>
        </div>

        <div className="panel-grid">
          <section className="activity-column">
            <h4>Sends</h4>
            <ul className="data-list">
              {recentSends.slice(0, 5).map((entry) => (
                <li key={entry.id}>
                  <p>{entry.fromEmail}</p>
                  <p className="muted-copy">{entry.providerStatus}</p>
                </li>
              ))}
              {recentSends.length === 0 && <li className="empty-message">No sends yet.</li>}
            </ul>
          </section>

          <section className="activity-column">
            <h4>Events</h4>
            <ul className="data-list">
              {recentEvents.slice(0, 5).map((entry) => (
                <li key={entry.id}>
                  <p>
                    {entry.provider}: {entry.eventType}
                  </p>
                  <p className="muted-copy">{formatTimestamp(entry.receivedAt)}</p>
                </li>
              ))}
              {recentEvents.length === 0 && (
                <li className="empty-message">No webhook events yet.</li>
              )}
            </ul>
          </section>

          <section className="activity-column">
            <h4>Audit</h4>
            <ul className="data-list">
              {recentAudit.slice(0, 5).map((entry) => (
                <li key={entry.id}>
                  <p>{entry.action}</p>
                  <p className="muted-copy">{formatTimestamp(entry.timestamp)}</p>
                </li>
              ))}
              {recentAudit.length === 0 && (
                <li className="empty-message">No audit actions yet.</li>
              )}
            </ul>
          </section>
        </div>
      </article>

      <article className="panel">
        <div className="section-header">
          <h3>Audit Snapshot</h3>
          <p className="muted-copy">Recent actions for quick verification and debugging.</p>
        </div>
        <table className="compact-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {recentAudit.slice(0, 8).map((entry) => (
              <tr key={entry.id}>
                <td>{formatTimestamp(entry.timestamp)}</td>
                <td>{entry.action}</td>
                <td>
                  {entry.targetType}:{entry.targetId}
                </td>
              </tr>
            ))}
            {recentAudit.length === 0 && (
              <tr>
                <td className="empty-message" colSpan={3}>
                  No audit records available yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
    </section>
  );
}
