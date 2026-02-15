import { useEffect, useMemo, useState } from "react";

import { useActiveTenant } from "../hooks/use-active-tenant";
import { trpc } from "../lib/trpc";

export function TenantsRoute() {
  const { activeTenantId } = useActiveTenant();
  const [tenantName, setTenantName] = useState("");
  const [mailchannelsAccountId, setMailchannelsAccountId] = useState("");
  const [mailchannelsApiKey, setMailchannelsApiKey] = useState("");
  const [agentmailApiKey, setAgentmailApiKey] = useState("");
  const [mailchannelsAccountIdEditing, setMailchannelsAccountIdEditing] = useState(false);
  const [mailchannelsApiKeyEditing, setMailchannelsApiKeyEditing] = useState(false);
  const [agentmailApiKeyEditing, setAgentmailApiKeyEditing] = useState(false);
  const [tenantSuccess, setTenantSuccess] = useState<string | null>(null);
  const [providerSuccess, setProviderSuccess] = useState<string | null>(null);
  const [providerSuccessFading, setProviderSuccessFading] = useState(false);

  const utils = trpc.useUtils();
  const tenants = trpc.tenants.list.useQuery();
  const providerStatus = trpc.tenants.providerStatus.useQuery(
    { tenantId: activeTenantId ?? "" },
    { enabled: Boolean(activeTenantId) },
  );

  const createTenant = trpc.tenants.create.useMutation({
    onMutate: () => {
      setTenantSuccess(null);
    },
    onSuccess: async (_, input) => {
      await utils.tenants.list.invalidate();
      setTenantName("");
      setTenantSuccess(`Tenant "${input.name.trim()}" created.`);
    },
  });

  const connectMailchannels = trpc.tenants.connectMailchannels.useMutation({
    onMutate: () => {
      setProviderSuccess(null);
    },
    onSuccess: async (_, input) => {
      await Promise.all([
        utils.logs.audit.invalidate(),
        utils.tenants.providerStatus.invalidate({ tenantId: input.tenantId }),
      ]);
      setMailchannelsAccountId("");
      setMailchannelsApiKey("");
      setMailchannelsAccountIdEditing(false);
      setMailchannelsApiKeyEditing(false);
      setProviderSuccess("MailChannels credentials saved.");
    },
  });

  const connectAgentmail = trpc.tenants.connectAgentmail.useMutation({
    onMutate: () => {
      setProviderSuccess(null);
    },
    onSuccess: async (_, input) => {
      await Promise.all([
        utils.logs.audit.invalidate(),
        utils.tenants.providerStatus.invalidate({ tenantId: input.tenantId }),
      ]);
      setAgentmailApiKey("");
      setAgentmailApiKeyEditing(false);
      setProviderSuccess("AgentMail API key saved.");
    },
  });

  const createTenantDisabledReason = useMemo(() => {
    if (tenantName.trim().length < 2) {
      return "Enter a tenant name with at least 2 characters.";
    }

    return null;
  }, [tenantName]);

  const providerDisabledReason = useMemo(() => {
    if (!activeTenantId) {
      return "Select a tenant first.";
    }

    return null;
  }, [activeTenantId]);

  useEffect(() => {
    setMailchannelsAccountId("");
    setMailchannelsApiKey("");
    setAgentmailApiKey("");
    setMailchannelsAccountIdEditing(false);
    setMailchannelsApiKeyEditing(false);
    setAgentmailApiKeyEditing(false);
    setProviderSuccess(null);
    setProviderSuccessFading(false);
  }, [activeTenantId]);

  useEffect(() => {
    if (!providerSuccess) {
      setProviderSuccessFading(false);
      return;
    }

    setProviderSuccessFading(false);

    const fadeTimeout = setTimeout(() => {
      setProviderSuccessFading(true);
    }, 2600);
    const dismissTimeout = setTimeout(() => {
      setProviderSuccess(null);
      setProviderSuccessFading(false);
    }, 3200);

    return () => {
      clearTimeout(fadeTimeout);
      clearTimeout(dismissTimeout);
    };
  }, [providerSuccess]);

  const mailchannelsAccountIdPreview = providerStatus.data?.mailchannelsAccountId ?? null;
  const mailchannelsParentApiKeyPreview = providerStatus.data?.mailchannelsParentApiKey ?? null;
  const agentmailApiKeyPreview = providerStatus.data?.agentmailApiKey ?? null;

  const isMailchannelsAccountIdConfigured = Boolean(mailchannelsAccountIdPreview);
  const isMailchannelsParentApiKeyConfigured = Boolean(mailchannelsParentApiKeyPreview);
  const isAgentmailApiKeyConfigured = Boolean(agentmailApiKeyPreview);

  const isMailchannelsAccountIdLocked =
    isMailchannelsAccountIdConfigured && !mailchannelsAccountIdEditing;
  const isMailchannelsParentApiKeyLocked =
    isMailchannelsParentApiKeyConfigured && !mailchannelsApiKeyEditing;
  const isAgentmailApiKeyLocked = isAgentmailApiKeyConfigured && !agentmailApiKeyEditing;

  const mailchannelsNeedsAccountIdInput =
    !isMailchannelsAccountIdConfigured || mailchannelsAccountIdEditing;
  const mailchannelsNeedsApiKeyInput =
    !isMailchannelsParentApiKeyConfigured || mailchannelsApiKeyEditing;
  const mailchannelsAccountIdReady =
    !mailchannelsNeedsAccountIdInput || mailchannelsAccountId.trim().length > 0;
  const mailchannelsApiKeyReady =
    !mailchannelsNeedsApiKeyInput || mailchannelsApiKey.trim().length > 0;
  const mailchannelsHasPendingChanges =
    (mailchannelsNeedsAccountIdInput && mailchannelsAccountId.trim().length > 0) ||
    (mailchannelsNeedsApiKeyInput && mailchannelsApiKey.trim().length > 0);

  const agentmailNeedsApiKeyInput = !isAgentmailApiKeyConfigured || agentmailApiKeyEditing;
  const agentmailHasPendingChanges =
    agentmailNeedsApiKeyInput && agentmailApiKey.trim().length > 0;

  const providerError =
    connectMailchannels.error?.message ??
    connectAgentmail.error?.message ??
    providerStatus.error?.message;

  const beginMailchannelsAccountIdEdit = () => {
    if (!isMailchannelsAccountIdLocked) {
      return;
    }

    setProviderSuccess(null);
    setMailchannelsAccountId("");
    setMailchannelsAccountIdEditing(true);
  };

  const beginMailchannelsApiKeyEdit = () => {
    if (!isMailchannelsParentApiKeyLocked) {
      return;
    }

    setProviderSuccess(null);
    setMailchannelsApiKey("");
    setMailchannelsApiKeyEditing(true);
  };

  const beginAgentmailApiKeyEdit = () => {
    if (!isAgentmailApiKeyLocked) {
      return;
    }

    setProviderSuccess(null);
    setAgentmailApiKey("");
    setAgentmailApiKeyEditing(true);
  };

  const restoreMailchannelsAccountIdPreview = () => {
    if (mailchannelsAccountIdEditing && mailchannelsAccountId.trim().length === 0) {
      setMailchannelsAccountIdEditing(false);
    }
  };

  const restoreMailchannelsApiKeyPreview = () => {
    if (mailchannelsApiKeyEditing && mailchannelsApiKey.trim().length === 0) {
      setMailchannelsApiKeyEditing(false);
    }
  };

  const restoreAgentmailApiKeyPreview = () => {
    if (agentmailApiKeyEditing && agentmailApiKey.trim().length === 0) {
      setAgentmailApiKeyEditing(false);
    }
  };

  return (
    <section className="stack">
      <article className="panel">
        <div className="section-header">
          <h2>Tenants</h2>
          <p className="muted-copy">
            Tenants isolate users, credentials, and operational activity.
          </p>
        </div>

        {tenants.isLoading && (
          <p className="status-pill info" role="status" aria-live="polite">
            Loading tenants...
          </p>
        )}
        {tenants.error && (
          <div className="status-banner error" role="alert">
            <p>Could not load tenants: {tenants.error.message}</p>
            <div className="status-actions">
              <button type="button" className="button-secondary" onClick={() => tenants.refetch()}>
                Retry
              </button>
            </div>
          </div>
        )}
        {tenantSuccess && (
          <p className="status-pill success" role="status" aria-live="polite">
            {tenantSuccess}
          </p>
        )}
        {createTenant.error && (
          <p className="status-pill error" role="alert">
            {createTenant.error.message}
          </p>
        )}

        <ul className="entity-list">
          {tenants.data?.map((tenant) => (
            <li key={tenant.id} className={tenant.id === activeTenantId ? "active" : ""}>
              <span>{tenant.name}</span>
              <span className="tag">{tenant.role}</span>
            </li>
          ))}
          {tenants.data?.length === 0 && (
            <li className="empty-message">
              No tenants yet. Create one below to begin managing providers.
            </li>
          )}
        </ul>

        <div className="form-grid">
          <label>
            New tenant name
            <input
              value={tenantName}
              onChange={(event) => {
                setTenantSuccess(null);
                setTenantName(event.target.value);
              }}
              placeholder="acme-mail"
            />
          </label>
          {createTenantDisabledReason && (
            <p className="hint-message">{createTenantDisabledReason}</p>
          )}
          <div className="button-row">
            <button
              type="button"
              onClick={() => createTenant.mutate({ name: tenantName.trim() })}
              disabled={createTenant.isPending || createTenantDisabledReason !== null}
            >
              {createTenant.isPending ? "Creating Tenant..." : "Create Tenant"}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => setTenantName("")}
              disabled={createTenant.isPending || tenantName.length === 0}
            >
              Clear
            </button>
          </div>
        </div>
      </article>

      <article className="panel">
        <div className="section-header">
          <h2>Provider Connections</h2>
          <p className="muted-copy">
            Store provider credentials for the selected tenant only.
          </p>
        </div>

        {providerDisabledReason && <p className="hint-message">{providerDisabledReason}</p>}
        {!providerDisabledReason && providerStatus.isLoading && (
          <p className="status-pill info" role="status" aria-live="polite">
            Loading stored provider credentials...
          </p>
        )}
        {connectMailchannels.isPending && (
          <p className="status-pill info" role="status" aria-live="polite">
            Saving MailChannels credentials...
          </p>
        )}
        {connectAgentmail.isPending && (
          <p className="status-pill info" role="status" aria-live="polite">
            Saving AgentMail credentials...
          </p>
        )}
        {providerSuccess && (
          <p
            className={`status-pill success auto-dismiss ${providerSuccessFading ? "is-fading" : ""}`}
            role="status"
            aria-live="polite"
          >
            {providerSuccess}
          </p>
        )}
        {providerError && (
          <p className="status-pill error" role="alert">
            {providerError}
          </p>
        )}

        <div className="connection-grid">
          <section className="sub-panel">
            <h3>MailChannels</h3>
            <p className="muted-copy">
              Required for sub-account provisioning and delivery controls.
            </p>
            <div className="form-grid">
              <label>
                Account ID
                <input
                  className={`credential-input ${isMailchannelsAccountIdLocked ? "configured" : ""}`}
                  value={
                    isMailchannelsAccountIdLocked
                      ? (mailchannelsAccountIdPreview ?? "")
                      : mailchannelsAccountId
                  }
                  onChange={(event) => {
                    setProviderSuccess(null);
                    setMailchannelsAccountId(event.target.value);
                  }}
                  onClick={beginMailchannelsAccountIdEdit}
                  onBlur={restoreMailchannelsAccountIdPreview}
                  readOnly={isMailchannelsAccountIdLocked}
                  title={isMailchannelsAccountIdLocked ? "Click to replace this credential." : undefined}
                  placeholder={
                    mailchannelsAccountIdEditing
                      ? "Enter a new MailChannels account id"
                      : "MailChannels account ID"
                  }
                />
              </label>
              {mailchannelsAccountIdEditing && isMailchannelsAccountIdConfigured && (
                <p className="hint-message">Enter a new MailChannels account id.</p>
              )}
              <label>
                Parent API key
                <input
                  className={`credential-input ${isMailchannelsParentApiKeyLocked ? "configured" : ""}`}
                  value={
                    isMailchannelsParentApiKeyLocked
                      ? (mailchannelsParentApiKeyPreview ?? "")
                      : mailchannelsApiKey
                  }
                  onChange={(event) => {
                    setProviderSuccess(null);
                    setMailchannelsApiKey(event.target.value);
                  }}
                  onClick={beginMailchannelsApiKeyEdit}
                  onBlur={restoreMailchannelsApiKeyPreview}
                  readOnly={isMailchannelsParentApiKeyLocked}
                  title={isMailchannelsParentApiKeyLocked ? "Click to replace this credential." : undefined}
                  placeholder={
                    mailchannelsApiKeyEditing
                      ? "Enter a new MailChannels parent API key"
                      : "MailChannels parent API key"
                  }
                />
              </label>
              {mailchannelsApiKeyEditing && isMailchannelsParentApiKeyConfigured && (
                <p className="hint-message">Enter a new MailChannels parent API key.</p>
              )}
              <button
                type="button"
                onClick={() =>
                  connectMailchannels.mutate({
                    tenantId: activeTenantId ?? "",
                    accountId: mailchannelsNeedsAccountIdInput
                      ? mailchannelsAccountId.trim()
                      : undefined,
                    parentApiKey: mailchannelsNeedsApiKeyInput
                      ? mailchannelsApiKey.trim()
                      : undefined,
                  })
                }
                disabled={
                  providerDisabledReason !== null ||
                  connectMailchannels.isPending ||
                  !mailchannelsAccountIdReady ||
                  !mailchannelsApiKeyReady ||
                  !mailchannelsHasPendingChanges
                }
              >
                {connectMailchannels.isPending
                  ? "Saving MailChannels..."
                  : "Save MailChannels"}
              </button>
            </div>
          </section>

          <section className="sub-panel">
            <h3>AgentMail</h3>
            <p className="muted-copy">Required for pod, domain, and inbox provisioning.</p>
            <div className="form-grid">
              <label>
                API key
                <input
                  className={`credential-input ${isAgentmailApiKeyLocked ? "configured" : ""}`}
                  value={
                    isAgentmailApiKeyLocked
                      ? (agentmailApiKeyPreview ?? "")
                      : agentmailApiKey
                  }
                  onChange={(event) => {
                    setProviderSuccess(null);
                    setAgentmailApiKey(event.target.value);
                  }}
                  onClick={beginAgentmailApiKeyEdit}
                  onBlur={restoreAgentmailApiKeyPreview}
                  readOnly={isAgentmailApiKeyLocked}
                  title={isAgentmailApiKeyLocked ? "Click to replace this credential." : undefined}
                  placeholder={
                    agentmailApiKeyEditing
                      ? "Enter a new AgentMail API key"
                      : "AgentMail API key"
                  }
                />
              </label>
              {agentmailApiKeyEditing && isAgentmailApiKeyConfigured && (
                <p className="hint-message">Enter a new AgentMail API key.</p>
              )}
              <button
                type="button"
                onClick={() =>
                  connectAgentmail.mutate({
                    tenantId: activeTenantId ?? "",
                    apiKey: agentmailApiKey.trim(),
                  })
                }
                disabled={
                  providerDisabledReason !== null ||
                  connectAgentmail.isPending ||
                  !agentmailHasPendingChanges
                }
              >
                {connectAgentmail.isPending ? "Saving AgentMail..." : "Save AgentMail"}
              </button>
            </div>
          </section>
        </div>
      </article>
    </section>
  );
}
