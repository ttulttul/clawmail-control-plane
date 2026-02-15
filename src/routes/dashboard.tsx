import { useActiveTenant } from "../hooks/use-active-tenant";
import { trpc } from "../lib/trpc";

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
    return <p>Create or select a tenant to start operating ClawMail.</p>;
  }

  return (
    <section className="panel-grid">
      <article className="panel">
        <h2>Recent Sends</h2>
        <p className="metric">{sends.data?.length ?? 0}</p>
        <ul>
          {sends.data?.map((entry) => (
            <li key={entry.id}>
              {entry.providerStatus} - {entry.fromEmail}
            </li>
          ))}
        </ul>
      </article>
      <article className="panel">
        <h2>Webhook Events</h2>
        <p className="metric">{events.data?.length ?? 0}</p>
        <ul>
          {events.data?.map((entry) => (
            <li key={entry.id}>
              {entry.provider}: {entry.eventType}
            </li>
          ))}
        </ul>
      </article>
      <article className="panel">
        <h2>Audit Trail</h2>
        <p className="metric">{audit.data?.length ?? 0}</p>
        <ul>
          {audit.data?.map((entry) => (
            <li key={entry.id}>{entry.action}</li>
          ))}
        </ul>
      </article>
    </section>
  );
}
