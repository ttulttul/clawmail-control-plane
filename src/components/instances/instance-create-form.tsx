export function InstanceCreateForm(props: {
  instanceName: string;
  createPending: boolean;
  onInstanceNameChange: (value: string) => void;
  onCreate: () => void;
}) {
  const { instanceName, createPending, onInstanceNameChange, onCreate } = props;

  return (
    <article className="panel">
      <h2>Create Instance</h2>
      <div className="button-row">
        <input
          value={instanceName}
          onChange={(event) => onInstanceNameChange(event.target.value)}
          placeholder="Instance name"
        />
        <button
          type="button"
          onClick={onCreate}
          disabled={createPending || instanceName.length < 2}
        >
          Create
        </button>
      </div>
    </article>
  );
}
