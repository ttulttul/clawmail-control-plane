import { useState } from "react";

import { useActiveTenant } from "../hooks/use-active-tenant";
import { trpc } from "../lib/trpc";

export function InstancesRoute() {
  const { activeTenantId } = useActiveTenant();

  const [instanceName, setInstanceName] = useState("");
  const [username, setUsername] = useState("agent");
  const [limit, setLimit] = useState(1000);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const instances = trpc.instances.list.useQuery(
    { tenantId: activeTenantId ?? "" },
    { enabled: Boolean(activeTenantId) },
  );

  const createInstance = trpc.instances.create.useMutation({
    onSuccess: async () => {
      await utils.instances.list.invalidate();
      setInstanceName("");
    },
  });

  const provisionSubaccount = trpc.mailchannels.provisionSubaccount.useMutation({
    onSuccess: async () => {
      await utils.instances.list.invalidate();
      await utils.logs.audit.invalidate();
    },
  });

  const createInbox = trpc.agentmail.createInbox.useMutation({
    onSuccess: async () => {
      await utils.logs.audit.invalidate();
    },
  });

  const rotateToken = trpc.instances.rotateToken.useMutation({
    onSuccess: async (response) => {
      setCreatedToken(response.token);
      await utils.logs.audit.invalidate();
    },
  });

  const suspend = trpc.mailchannels.suspendSubaccount.useMutation({
    onSuccess: async () => {
      await utils.instances.list.invalidate();
    },
  });

  const activate = trpc.mailchannels.activateSubaccount.useMutation({
    onSuccess: async () => {
      await utils.instances.list.invalidate();
    },
  });

  if (!activeTenantId) {
    return <p>Select a tenant to manage instances.</p>;
  }

  return (
    <section className="stack">
      <article className="panel">
        <h2>Create Instance</h2>
        <div className="button-row">
          <input
            value={instanceName}
            onChange={(event) => setInstanceName(event.target.value)}
            placeholder="Instance name"
          />
          <button
            type="button"
            onClick={() =>
              createInstance.mutate({
                tenantId: activeTenantId,
                name: instanceName,
                mode: "gateway",
              })
            }
            disabled={createInstance.isPending || instanceName.length < 2}
          >
            Create
          </button>
        </div>
      </article>

      <article className="panel">
        <h2>Instances</h2>
        <ul>
          {instances.data?.map((instance) => (
            <li key={instance.id} className="instance-row">
              <div>
                <strong>{instance.name}</strong>
                <p>
                  {instance.mode} | {instance.status}
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
                >
                  Provision MailChannels
                </button>
                <button
                  type="button"
                  onClick={() =>
                    createInbox.mutate({
                      tenantId: activeTenantId,
                      instanceId: instance.id,
                      username,
                    })
                  }
                >
                  Provision Inbox
                </button>
                <button
                  type="button"
                  onClick={() =>
                    rotateToken.mutate({
                      tenantId: activeTenantId,
                      instanceId: instance.id,
                      scopes: ["send", "read_inbox"],
                      expiresInHours: null,
                    })
                  }
                >
                  Rotate Gateway Token
                </button>
                <button
                  type="button"
                  onClick={() =>
                    suspend.mutate({
                      tenantId: activeTenantId,
                      instanceId: instance.id,
                    })
                  }
                >
                  Suspend
                </button>
                <button
                  type="button"
                  onClick={() =>
                    activate.mutate({
                      tenantId: activeTenantId,
                      instanceId: instance.id,
                    })
                  }
                >
                  Activate
                </button>
              </div>
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
              onChange={(event) => setLimit(Number(event.target.value))}
            />
          </label>
          <label>
            Inbox username
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
        </div>
        {createdToken && (
          <p className="token-output">
            New gateway token (shown once): <code>{createdToken}</code>
          </p>
        )}
      </article>
    </section>
  );
}
