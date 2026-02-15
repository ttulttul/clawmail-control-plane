interface Notice {
  tone: "info" | "success" | "error";
  message: string;
}

export function InstanceCreateForm(props: {
  instanceName: string;
  createPending: boolean;
  createDisabledReason: string | null;
  notice: Notice | null;
  onInstanceNameChange: (value: string) => void;
  onCreate: () => void;
  onClear: () => void;
}) {
  const {
    instanceName,
    createPending,
    createDisabledReason,
    notice,
    onInstanceNameChange,
    onCreate,
    onClear,
  } = props;

  return (
    <article className="panel">
      <div className="section-header">
        <h2>Create Instance</h2>
        <p className="muted-copy">
          Instances define blast radius for tokens, provider operations, and audit traces.
        </p>
      </div>

      {createDisabledReason && <p className="hint-message">{createDisabledReason}</p>}
      {createPending && (
        <p className="status-pill info" role="status" aria-live="polite">
          Creating instance...
        </p>
      )}
      {notice && (
        <p className={`status-pill ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
          {notice.message}
        </p>
      )}

      <div className="button-row">
        <input
          value={instanceName}
          onChange={(event) => onInstanceNameChange(event.target.value)}
          placeholder="gateway-west"
        />
        <button
          type="button"
          onClick={onCreate}
          disabled={createPending || createDisabledReason !== null}
        >
          {createPending ? "Creating..." : "Create Instance"}
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={onClear}
          disabled={createPending || instanceName.length === 0}
        >
          Clear
        </button>
      </div>
    </article>
  );
}
