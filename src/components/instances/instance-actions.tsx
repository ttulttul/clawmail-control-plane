export function InstanceActions(props: {
  instanceId: string;
  instanceName: string;
  actionPending: boolean;
  usernameValid: boolean;
  onProvisionMailchannels: (instanceId: string) => void;
  onProvisionInbox: (instanceId: string) => void;
  onRotateGatewayToken: (instanceId: string, instanceName: string) => void;
  onSuspend: (instanceId: string, instanceName: string) => void;
  onActivate: (instanceId: string) => void;
}) {
  const {
    instanceId,
    instanceName,
    actionPending,
    usernameValid,
    onProvisionMailchannels,
    onProvisionInbox,
    onRotateGatewayToken,
    onSuspend,
    onActivate,
  } = props;

  return (
    <div className="button-row">
      <button
        type="button"
        onClick={() => onProvisionMailchannels(instanceId)}
        disabled={actionPending}
      >
        Provision MailChannels
      </button>
      <button
        type="button"
        onClick={() => onProvisionInbox(instanceId)}
        disabled={actionPending || !usernameValid}
      >
        Provision Inbox
      </button>
      <button
        type="button"
        onClick={() => onRotateGatewayToken(instanceId, instanceName)}
        disabled={actionPending}
      >
        Rotate Gateway Token
      </button>
      <button
        type="button"
        className="danger-button"
        onClick={() => onSuspend(instanceId, instanceName)}
        disabled={actionPending}
      >
        Suspend
      </button>
      <button
        type="button"
        className="button-secondary"
        onClick={() => onActivate(instanceId)}
        disabled={actionPending}
      >
        Activate
      </button>
    </div>
  );
}
