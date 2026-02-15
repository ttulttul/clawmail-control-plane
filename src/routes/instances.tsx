import { useMemo, useState } from "react";

import { useActiveTenant } from "../hooks/use-active-tenant";
import { trpc } from "../lib/trpc";

type NoticeTone = "info" | "success" | "error";

interface RouteNotice {
  tone: NoticeTone;
  message: string;
}

function shouldProceed(message: string): boolean {
  return window.confirm(message);
}

export function InstancesRoute() {
  const { activeTenantId } = useActiveTenant();

  const [instanceName, setInstanceName] = useState("");
  const [username, setUsername] = useState("agent");
  const [limit, setLimit] = useState(1000);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [pendingActionLabel, setPendingActionLabel] = useState<string | null>(null);
  const [notice, setNotice] = useState<RouteNotice | null>(null);

  const utils = trpc.useUtils();

  const instances = trpc.instances.list.useQuery(
    { tenantId: activeTenantId ?? "" },
    { enabled: Boolean(activeTenantId) },
  );

  const createInstance = trpc.instances.create.useMutation({
    onMutate: () => {
      setNotice({ tone: "info", message: "Creating instance..." });
    },
    onSuccess: async (_, input) => {
      await utils.instances.list.invalidate();
      setInstanceName("");
      setNotice({
        tone: "success",
        message: `Instance "${input.name}" created.`,
      });
    },
    onError: (error) => {
      setNotice({ tone: "error", message: error.message });
    },
  });

  const provisionSubaccount = trpc.mailchannels.provisionSubaccount.useMutation({
    onMutate: (variables) => {
      setPendingActionLabel(`Provisioning MailChannels for "${variables.instanceId}"...`);
    },
    onSuccess: async (_, variables) => {
      await utils.instances.list.invalidate();
      await utils.logs.audit.invalidate();
      setPendingActionLabel(null);
      setNotice({
        tone: "success",
        message: `MailChannels provisioned for instance "${variables.instanceId}".`,
      });
    },
    onError: (error) => {
      setPendingActionLabel(null);
      setNotice({ tone: "error", message: error.message });
    },
  });

  const createInbox = trpc.agentmail.createInbox.useMutation({
    onMutate: (variables) => {
      setPendingActionLabel(`Provisioning inbox for "${variables.instanceId}"...`);
    },
    onSuccess: async (_, variables) => {
      await utils.logs.audit.invalidate();
      setPendingActionLabel(null);
      setNotice({
        tone: "success",
        message: `Inbox provisioned for instance "${variables.instanceId}".`,
      });
    },
    onError: (error) => {
      setPendingActionLabel(null);
      setNotice({ tone: "error", message: error.message });
    },
  });

  const rotateToken = trpc.instances.rotateToken.useMutation({
    onMutate: (variables) => {
      setPendingActionLabel(`Rotating gateway token for "${variables.instanceId}"...`);
    },
    onSuccess: async (response, variables) => {
      setCreatedToken(response.token);
      await utils.logs.audit.invalidate();
      setPendingActionLabel(null);
      setNotice({
        tone: "success",
        message: `Gateway token rotated for instance "${variables.instanceId}".`,
      });
    },
    onError: (error) => {
      setPendingActionLabel(null);
      setNotice({ tone: "error", message: error.message });
    },
  });

  const suspend = trpc.mailchannels.suspendSubaccount.useMutation({
    onMutate: (variables) => {
      setPendingActionLabel(`Suspending sub-account for "${variables.instanceId}"...`);
    },
    onSuccess: async (_, variables) => {
      await utils.instances.list.invalidate();
      setPendingActionLabel(null);
      setNotice({
        tone: "success",
        message: `Sub-account suspended for instance "${variables.instanceId}".`,
      });
    },
    onError: (error) => {
      setPendingActionLabel(null);
      setNotice({ tone: "error", message: error.message });
    },
  });

  const activate = trpc.mailchannels.activateSubaccount.useMutation({
    onMutate: (variables) => {
      setPendingActionLabel(`Activating sub-account for "${variables.instanceId}"...`);
    },
    onSuccess: async (_, variables) => {
      await utils.instances.list.invalidate();
      setPendingActionLabel(null);
      setNotice({
        tone: "success",
        message: `Sub-account activated for instance "${variables.instanceId}".`,
      });
    },
    onError: (error) => {
      setPendingActionLabel(null);
      setNotice({ tone: "error", message: error.message });
    },
  });

  const actionPending =
    provisionSubaccount.isPending ||
    createInbox.isPending ||
    rotateToken.isPending ||
    suspend.isPending ||
    activate.isPending;

  const createDisabledReason = useMemo(() => {
    if (instanceName.trim().length < 2) {
      return "Enter an instance name with at least 2 characters.";
    }

    return null;
  }, [instanceName]);

  if (!activeTenantId) {
    return (
      <section className="panel">
        <h2>Select a tenant</h2>
        <p className="muted-copy">
          Pick a tenant from the header to manage instances and gateway access.
        </p>
      </section>
    );
  }

  return (
    <section className="stack">
      <article className="panel">
        <div className="section-header">
          <h2>Create Instance</h2>
          <p className="muted-copy">
            Instances define blast radius for tokens, provider operations, and audit traces.
          </p>
        </div>

        {createDisabledReason && <p className="hint-message">{createDisabledReason}</p>}
        {createInstance.isPending && (
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
            onChange={(event) => {
              setNotice(null);
              setInstanceName(event.target.value);
            }}
            placeholder="gateway-west"
          />
          <button
            type="button"
            onClick={() =>
              createInstance.mutate({
                tenantId: activeTenantId,
                name: instanceName.trim(),
                mode: "gateway",
              })
            }
            disabled={createInstance.isPending || createDisabledReason !== null}
          >
            {createInstance.isPending ? "Creating..." : "Create Instance"}
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() => setInstanceName("")}
            disabled={createInstance.isPending || instanceName.length === 0}
          >
            Clear
          </button>
        </div>
      </article>

      <article className="panel">
        <div className="section-header">
          <h2>Instances</h2>
          <p className="muted-copy">
            Run provider operations per instance. Destructive actions require confirmation.
          </p>
        </div>

        {instances.isLoading && (
          <p className="status-pill info" role="status" aria-live="polite">
            Loading instances...
          </p>
        )}
        {instances.error && (
          <div className="status-banner error" role="alert">
            <p>Could not load instances: {instances.error.message}</p>
            <div className="status-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => instances.refetch()}
              >
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
              onChange={(event) => setLimit(Number(event.target.value))}
            />
          </label>
          <label>
            Inbox username
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
        </div>

        <ul className="instance-list">
          {instances.data?.map((instance) => (
            <li key={instance.id} className="instance-row">
              <div>
                <strong>{instance.name}</strong>
                <p>
                  Mode: {instance.mode} | Status: {instance.status}
                </p>
              </div>
              <div className="button-row">
                <button
                  type="button"
                  onClick={() =>
                    provisionSubaccount.mutate({
                      tenantId: activeTenantId,
                      instanceId: instance.id,
                      limit,
                      suspended: false,
                      persistDirectKey: false,
                    })
                  }
                  disabled={actionPending}
                >
                  Provision MailChannels
                </button>
                <button
                  type="button"
                  onClick={() =>
                    createInbox.mutate({
                      tenantId: activeTenantId,
                      instanceId: instance.id,
                      username: username.trim(),
                    })
                  }
                  disabled={actionPending || username.trim().length < 1}
                >
                  Provision Inbox
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      !shouldProceed(
                        `Rotate token for "${instance.name}"? Existing tokens will stop working.`,
                      )
                    ) {
                      return;
                    }
                    rotateToken.mutate({
                      tenantId: activeTenantId,
                      instanceId: instance.id,
                      scopes: ["send", "read_inbox"],
                      expiresInHours: null,
                    });
                  }}
                  disabled={actionPending}
                >
                  Rotate Gateway Token
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => {
                    if (
                      !shouldProceed(
                        `Suspend sending for "${instance.name}"? You can re-activate later.`,
                      )
                    ) {
                      return;
                    }
                    suspend.mutate({
                      tenantId: activeTenantId,
                      instanceId: instance.id,
                    });
                  }}
                  disabled={actionPending}
                >
                  Suspend
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() =>
                    activate.mutate({
                      tenantId: activeTenantId,
                      instanceId: instance.id,
                    })
                  }
                  disabled={actionPending}
                >
                  Activate
                </button>
              </div>
            </li>
          ))}
          {instances.data?.length === 0 && (
            <li className="empty-message">
              No instances found. Create one to issue gateway tokens and run provider actions.
            </li>
          )}
        </ul>

        {createdToken && (
          <div className="token-output">
            <p>New gateway token (shown once):</p>
            <code>{createdToken}</code>
            <div className="status-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setCreatedToken(null)}
              >
                Hide Token
              </button>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
