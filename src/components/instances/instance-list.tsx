import type { RouterOutputs } from "../../types/trpc";

import { InstanceActions } from "./instance-actions";

type InstanceListRows = RouterOutputs["instances"]["list"];

export function InstanceList(props: {
  instances: InstanceListRows | undefined;
  limit: number;
  username: string;
  onLimitChange: (value: number) => void;
  onUsernameChange: (value: string) => void;
  onProvisionMailchannels: (instanceId: string) => void;
  onProvisionInbox: (instanceId: string) => void;
  onRotateGatewayToken: (instanceId: string) => void;
  onSuspend: (instanceId: string) => void;
  onActivate: (instanceId: string) => void;
}) {
  const {
    instances,
    limit,
    username,
    onLimitChange,
    onUsernameChange,
    onProvisionMailchannels,
    onProvisionInbox,
    onRotateGatewayToken,
    onSuspend,
    onActivate,
  } = props;

  return (
    <article className="panel">
      <h2>Instances</h2>
      <ul>
        {instances?.map((instance) => (
          <li key={instance.id} className="instance-row">
            <div>
              <strong>{instance.name}</strong>
              <p>
                {instance.mode} | {instance.status}
              </p>
            </div>
            <InstanceActions
              instanceId={instance.id}
              onProvisionMailchannels={onProvisionMailchannels}
              onProvisionInbox={onProvisionInbox}
              onRotateGatewayToken={onRotateGatewayToken}
              onSuspend={onSuspend}
              onActivate={onActivate}
            />
          </li>
        ))}
      </ul>
      <div className="button-row">
        <label>
          Default limit
          <input
            type="number"
            min={-1}
            value={limit}
            onChange={(event) => onLimitChange(Number(event.target.value))}
          />
        </label>
        <label>
          Inbox username
          <input value={username} onChange={(event) => onUsernameChange(event.target.value)} />
        </label>
      </div>
    </article>
  );
}
