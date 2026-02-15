import type { RouterOutputs } from "../../types/trpc";

import { InstanceActions } from "./instance-actions";

type InstanceListRows = RouterOutputs["instances"]["list"];

export function InstanceList(props: {
  instances: InstanceListRows | undefined;
  isLoading: boolean;
  errorMessage: string | null;
  pendingActionLabel: string | null;
  actionPending: boolean;
  limit: number;
  username: string;
  onRetry: () => void;
  onLimitChange: (value: number) => void;
  onUsernameChange: (value: string) => void;
  onProvisionMailchannels: (instanceId: string) => void;
  onProvisionInbox: (instanceId: string) => void;
  onRotateGatewayToken: (instanceId: string, instanceName: string) => void;
  onSuspend: (instanceId: string, instanceName: string) => void;
  onActivate: (instanceId: string) => void;
}) {
  const {
    instances,
    isLoading,
    errorMessage,
    pendingActionLabel,
    actionPending,
    limit,
    username,
    onRetry,
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
      <div className="section-header">
        <h2>Instances</h2>
        <p className="muted-copy">
          Run provider operations per instance. Destructive actions require confirmation.
        </p>
      </div>

      {isLoading && (
        <p className="status-pill info" role="status" aria-live="polite">
          Loading instances...
        </p>
      )}
      {errorMessage && (
        <div className="status-banner error" role="alert">
          <p>Could not load instances: {errorMessage}</p>
          <div className="status-actions">
            <button type="button" className="button-secondary" onClick={onRetry}>
              Retry
            </button>
          </div>
        </div>
      )}
      {pendingActionLabel && (
        <p className="status-pill info" role="status" aria-live="polite">
          {pendingActionLabel}
        </p>
      )}

      <div className="form-grid compact-gap">
        <label>
          Default send limit
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

      <ul className="instance-list">
        {instances?.map((instance) => (
          <li key={instance.id} className="instance-row">
            <div>
              <strong>{instance.name}</strong>
              <p>
                Mode: {instance.mode} | Status: {instance.status}
              </p>
            </div>
            <InstanceActions
              instanceId={instance.id}
              instanceName={instance.name}
              actionPending={actionPending}
              usernameValid={username.trim().length > 0}
              onProvisionMailchannels={onProvisionMailchannels}
              onProvisionInbox={onProvisionInbox}
              onRotateGatewayToken={onRotateGatewayToken}
              onSuspend={onSuspend}
              onActivate={onActivate}
            />
          </li>
        ))}
        {instances?.length === 0 && (
          <li className="empty-message">
            No instances found. Create one to issue gateway tokens and run provider actions.
          </li>
        )}
      </ul>
    </article>
  );
}
