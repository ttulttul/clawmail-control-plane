export function GatewayTokenPanel(props: { token: string | null }) {
  if (!props.token) {
    return null;
  }

  return (
    <p className="token-output">
      New gateway token (shown once): <code>{props.token}</code>
    </p>
  );
}
