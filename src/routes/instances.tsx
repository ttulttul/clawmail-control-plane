import { useMemo, useState } from "react";

import { GatewayTokenPanel } from "../components/instances/gateway-token-panel";
import { InstanceCreateForm } from "../components/instances/instance-create-form";
import { InstanceList } from "../components/instances/instance-list";
import { useActiveRisk } from "../hooks/use-active-risk";
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
  const { activeRiskId } = useActiveRisk();

  const [instanceName, setInstanceName] = useState("");
  const [username, setUsername] = useState("agent");
  const [limit, setLimit] = useState(1000);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [pendingActionLabel, setPendingActionLabel] = useState<string | null>(null);
  const [notice, setNotice] = useState<RouteNotice | null>(null);

  const utils = trpc.useUtils();

  const instances = trpc.instances.list.useQuery(
    { riskId: activeRiskId ?? "" },
    { enabled: Boolean(activeRiskId) },
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

  if (!activeRiskId) {
    return (
      <section className="panel">
        <h2>Select a Risk 🦞🦞🦞</h2>
        <p className="muted-copy">
          Pick a risk from the header to manage instances and gateway access.
        </p>
      </section>
    );
  }

  const riskId = activeRiskId;

  function handleCreateInstance(): void {
    createInstance.mutate({
      riskId,
      name: instanceName.trim(),
      mode: "gateway",
    });
  }

  function handleProvisionMailchannels(instanceId: string): void {
    provisionSubaccount.mutate({
      riskId,
      instanceId,
      limit,
      suspended: false,
      persistDirectKey: false,
    });
  }

  function handleProvisionInbox(instanceId: string): void {
    createInbox.mutate({
      riskId,
      instanceId,
      username: username.trim(),
    });
  }

  function handleRotateToken(instanceId: string, instanceNameValue: string): void {
    if (
      !shouldProceed(
        `Rotate token for "${instanceNameValue}"? Existing tokens will stop working.`,
      )
    ) {
      return;
    }

    rotateToken.mutate({
      riskId,
      instanceId,
      scopes: ["send", "read_inbox"],
      expiresInHours: null,
    });
  }

  function handleSuspend(instanceId: string, instanceNameValue: string): void {
    if (
      !shouldProceed(
        `Suspend sending for "${instanceNameValue}"? You can re-activate later.`,
      )
    ) {
      return;
    }

    suspend.mutate({
      riskId,
      instanceId,
    });
  }

  function handleActivate(instanceId: string): void {
    activate.mutate({
      riskId,
      instanceId,
    });
  }

  return (
    <section className="stack">
      <InstanceCreateForm
        instanceName={instanceName}
        createPending={createInstance.isPending}
        createDisabledReason={createDisabledReason}
        notice={notice}
        onInstanceNameChange={(value) => {
          setNotice(null);
          setInstanceName(value);
        }}
        onCreate={handleCreateInstance}
        onClear={() => setInstanceName("")}
      />
      <InstanceList
        instances={instances.data}
        isLoading={instances.isLoading}
        errorMessage={instances.error?.message ?? null}
        pendingActionLabel={pendingActionLabel}
        actionPending={actionPending}
        limit={limit}
        username={username}
        onRetry={() => {
          void instances.refetch();
        }}
        onLimitChange={setLimit}
        onUsernameChange={setUsername}
        onProvisionMailchannels={handleProvisionMailchannels}
        onProvisionInbox={handleProvisionInbox}
        onRotateGatewayToken={handleRotateToken}
        onSuspend={handleSuspend}
        onActivate={handleActivate}
      />
      <GatewayTokenPanel token={createdToken} onHide={() => setCreatedToken(null)} />
    </section>
  );
}
