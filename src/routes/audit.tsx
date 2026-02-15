import { useActiveTenant } from "../hooks/use-active-tenant";
import { trpc } from "../lib/trpc";

export function AuditRoute() {
  const { activeTenantId } = useActiveTenant();

  const audit = trpc.logs.audit.useQuery(
    {
      tenantId: activeTenantId ?? "",
      limit: 100,
    },
    { enabled: Boolean(activeTenantId) },
  );

  if (!activeTenantId) {
    return <p>Select a tenant to inspect the audit log.</p>;
  }

  return (
    <section className="panel">
      <h2>Audit Log</h2>
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Action</th>
            <th>Target</th>
          </tr>
        </thead>
        <tbody>
          {audit.data?.map((entry) => (
            <tr key={entry.id}>
              <td>{new Date(entry.timestamp).toLocaleString()}</td>
              <td>{entry.action}</td>
              <td>
                {entry.targetType}:{entry.targetId}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
