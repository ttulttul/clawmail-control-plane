export function InstanceActions(props: {
  instanceId: string;
  onProvisionMailchannels: (instanceId: string) => void;
  onProvisionInbox: (instanceId: string) => void;
  onRotateGatewayToken: (instanceId: string) => void;
  onSuspend: (instanceId: string) => void;
  onActivate: (instanceId: string) => void;
}) {
  const {
    instanceId,
    onProvisionMailchannels,
    onProvisionInbox,
    onRotateGatewayToken,
    onSuspend,
    onActivate,
  } = props;

  return (
    <div className="button-row">
      <button type="button" onClick={() => onProvisionMailchannels(instanceId)}>
        Provision MailChannels
      </button>
      <button type="button" onClick={() => onProvisionInbox(instanceId)}>
        Provision Inbox
      </button>
      <button type="button" onClick={() => onRotateGatewayToken(instanceId)}>
        Rotate Gateway Token
      </button>
      <button type="button" onClick={() => onSuspend(instanceId)}>
        Suspend
      </button>
      <button type="button" onClick={() => onActivate(instanceId)}>
        Activate
      </button>
    </div>
  );
}
