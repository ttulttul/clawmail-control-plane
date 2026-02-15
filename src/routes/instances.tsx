import { useState } from "react";

import { GatewayTokenPanel } from "../components/instances/gateway-token-panel";
import { InstanceCreateForm } from "../components/instances/instance-create-form";
import { InstanceList } from "../components/instances/instance-list";
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

  const tenantId = activeTenantId;

  function handleCreateInstance(): void {
    createInstance.mutate({
      tenantId,
      name: instanceName,
      mode: "gateway",
    });
  }

  function handleProvisionMailchannels(instanceId: string): void {
    provisionSubaccount.mutate({
      tenantId,
      instanceId,
      limit,
      suspended: false,
      persistDirectKey: false,
    });
  }

  function handleProvisionInbox(instanceId: string): void {
    createInbox.mutate({
      tenantId,
      instanceId,
      username,
    });
  }

  function handleRotateToken(instanceId: string): void {
    rotateToken.mutate({
      tenantId,
      instanceId,
      scopes: ["send", "read_inbox"],
      expiresInHours: null,
    });
  }

  function handleSuspend(instanceId: string): void {
    suspend.mutate({
      tenantId,
      instanceId,
    });
  }

  function handleActivate(instanceId: string): void {
    activate.mutate({
      tenantId,
      instanceId,
    });
  }

  return (
    <section className="stack">
      <InstanceCreateForm
        instanceName={instanceName}
        createPending={createInstance.isPending}
        onInstanceNameChange={setInstanceName}
        onCreate={handleCreateInstance}
      />
      <InstanceList
        instances={instances.data}
        limit={limit}
        username={username}
        onLimitChange={setLimit}
        onUsernameChange={setUsername}
        onProvisionMailchannels={handleProvisionMailchannels}
        onProvisionInbox={handleProvisionInbox}
        onRotateGatewayToken={handleRotateToken}
        onSuspend={handleSuspend}
        onActivate={handleActivate}
      />
      <GatewayTokenPanel token={createdToken} />
    </section>
  );
}
