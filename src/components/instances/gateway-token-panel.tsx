export function GatewayTokenPanel(props: {
  token: string | null;
  onHide: () => void;
}) {
  if (!props.token) {
    return null;
  }

  return (
    <div className="token-output">
      <p>New gateway token (shown once):</p>
      <code>{props.token}</code>
      <div className="status-actions">
        <button type="button" className="button-secondary" onClick={props.onHide}>
          Hide Token
        </button>
      </div>
    </div>
  );
}
