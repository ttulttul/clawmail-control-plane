import { useMemo, useState } from "react";

import { useActiveTenant } from "../hooks/use-active-tenant";
import { trpc } from "../lib/trpc";

export function TenantsRoute() {
  const { activeTenantId } = useActiveTenant();
  const [tenantName, setTenantName] = useState("");
  const [mailchannelsAccountId, setMailchannelsAccountId] = useState("");
  const [mailchannelsApiKey, setMailchannelsApiKey] = useState("");
  const [agentmailApiKey, setAgentmailApiKey] = useState("");
  const [tenantSuccess, setTenantSuccess] = useState<string | null>(null);
  const [providerSuccess, setProviderSuccess] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const tenants = trpc.tenants.list.useQuery();

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
    onSuccess: async () => {
      await utils.logs.audit.invalidate();
      setMailchannelsAccountId("");
      setMailchannelsApiKey("");
      setProviderSuccess("MailChannels credentials verified and saved.");
    },
  });

  const connectAgentmail = trpc.tenants.connectAgentmail.useMutation({
    onMutate: () => {
      setProviderSuccess(null);
    },
    onSuccess: async () => {
      await utils.logs.audit.invalidate();
      setAgentmailApiKey("");
      setProviderSuccess("AgentMail API key verified and saved.");
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

  const providerError = connectMailchannels.error?.message ?? connectAgentmail.error?.message;

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
        {connectMailchannels.isPending && (
          <p className="status-pill info" role="status" aria-live="polite">
            Validating and saving MailChannels credentials...
          </p>
        )}
        {connectAgentmail.isPending && (
          <p className="status-pill info" role="status" aria-live="polite">
            Validating and saving AgentMail credentials...
          </p>
        )}
        {providerSuccess && (
          <p className="status-pill success" role="status" aria-live="polite">
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
                  value={mailchannelsAccountId}
                  onChange={(event) => {
                    setProviderSuccess(null);
                    setMailchannelsAccountId(event.target.value);
                  }}
                  placeholder="MailChannels account ID"
                />
              </label>
              <label>
                Parent API key
                <input
                  value={mailchannelsApiKey}
                  onChange={(event) => {
                    setProviderSuccess(null);
                    setMailchannelsApiKey(event.target.value);
                  }}
                  placeholder="MailChannels parent API key"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  connectMailchannels.mutate({
                    tenantId: activeTenantId ?? "",
                    accountId: mailchannelsAccountId.trim(),
                    parentApiKey: mailchannelsApiKey.trim(),
                  })
                }
                disabled={
                  providerDisabledReason !== null ||
                  connectMailchannels.isPending ||
                  mailchannelsAccountId.trim().length === 0 ||
                  mailchannelsApiKey.trim().length === 0
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
                  value={agentmailApiKey}
                  onChange={(event) => {
                    setProviderSuccess(null);
                    setAgentmailApiKey(event.target.value);
                  }}
                  placeholder="AgentMail API key"
                />
              </label>
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
                  agentmailApiKey.trim().length === 0
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
