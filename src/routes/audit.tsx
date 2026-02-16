import { useActiveCast } from "../hooks/use-active-cast";
import { trpc } from "../lib/trpc";

function formatTimestamp(value: string | number): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return String(value);
  }

  return timestamp.toLocaleString();
}

export function AuditRoute() {
  const { activeCastId } = useActiveCast();

  const audit = trpc.logs.audit.useQuery(
    {
      castId: activeCastId ?? "",
      limit: 100,
    },
    { enabled: Boolean(activeCastId) },
  );

  if (!activeCastId) {
    return (
      <section className="panel">
        <h2>Select a Cast 🦀🦀🦀</h2>
        <p className="muted-copy">
          Choose a cast to inspect the audit timeline.
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
                No audit entries yet for this cast.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
