import { useActiveRisk } from "../hooks/use-active-risk";
import { trpc } from "../lib/trpc";

function formatTimestamp(value: string | number): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return String(value);
  }

  return timestamp.toLocaleString();
}

export function AuditRoute() {
  const { activeRiskId } = useActiveRisk();

  const audit = trpc.logs.audit.useQuery(
    {
      riskId: activeRiskId ?? "",
      limit: 100,
    },
    { enabled: Boolean(activeRiskId) },
  );

  if (!activeRiskId) {
    return (
      <section className="panel">
        <h2>Select a Risk 🦞🦞🦞</h2>
        <p className="muted-copy">
          Choose a risk to inspect the audit timeline.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-header">
        <h2>Audit Log</h2>
        <p className="muted-copy">
          Every operational action is recorded with timestamp and target.
        </p>
      </div>

      {audit.isLoading && (
        <p className="status-pill info" role="status" aria-live="polite">
          Loading audit entries...
        </p>
      )}
      {audit.error && (
        <div className="status-banner error" role="alert">
          <p>Could not load audit entries: {audit.error.message}</p>
          <div className="status-actions">
            <button type="button" className="button-secondary" onClick={() => audit.refetch()}>
              Retry
            </button>
          </div>
        </div>
      )}

      <table className="compact-table">
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
              <td>{formatTimestamp(entry.timestamp)}</td>
              <td>{entry.action}</td>
              <td>
                {entry.targetType}:{entry.targetId}
              </td>
            </tr>
          ))}
          {audit.data?.length === 0 && (
            <tr>
              <td colSpan={3} className="empty-message">
                No audit entries yet for this risk.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
