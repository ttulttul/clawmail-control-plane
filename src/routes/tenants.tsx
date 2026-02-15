import { useState } from "react";

import { useActiveTenant } from "../hooks/use-active-tenant";
import { trpc } from "../lib/trpc";

export function TenantsRoute() {
  const { activeTenantId } = useActiveTenant();
  const [tenantName, setTenantName] = useState("");
  const [mailchannelsAccountId, setMailchannelsAccountId] = useState("");
  const [mailchannelsApiKey, setMailchannelsApiKey] = useState("");
  const [agentmailApiKey, setAgentmailApiKey] = useState("");

  const utils = trpc.useUtils();
  const tenants = trpc.tenants.list.useQuery();

  const createTenant = trpc.tenants.create.useMutation({
    onSuccess: async () => {
      await utils.tenants.list.invalidate();
      setTenantName("");
    },
  });

  const connectMailchannels = trpc.tenants.connectMailchannels.useMutation({
    onSuccess: async () => {
      await utils.logs.audit.invalidate();
      setMailchannelsAccountId("");
      setMailchannelsApiKey("");
    },
  });

  const connectAgentmail = trpc.tenants.connectAgentmail.useMutation({
    onSuccess: async () => {
      await utils.logs.audit.invalidate();
      setAgentmailApiKey("");
    },
  });

  return (
    <section className="stack">
      <article className="panel">
        <h2>Tenants</h2>
        <ul>
          {tenants.data?.map((tenant) => (
            <li key={tenant.id}>
              {tenant.name} ({tenant.role})
            </li>
          ))}
        </ul>
        <div className="button-row">
          <input
            value={tenantName}
            onChange={(event) => setTenantName(event.target.value)}
            placeholder="Tenant name"
          />
          <button
            type="button"
            onClick={() => createTenant.mutate({ name: tenantName })}
            disabled={createTenant.isPending || tenantName.length < 2}
          >
            Create Tenant
          </button>
        </div>
      </article>

      <article className="panel">
        <h2>Provider Connections</h2>
        {!activeTenantId && <p>Select a tenant first.</p>}
        {activeTenantId && (
          <>
            <h3>MailChannels</h3>
            <div className="form-grid">
              <input
                value={mailchannelsAccountId}
                onChange={(event) => setMailchannelsAccountId(event.target.value)}
                placeholder="MailChannels Account ID"
              />
              <input
                value={mailchannelsApiKey}
                onChange={(event) => setMailchannelsApiKey(event.target.value)}
                placeholder="MailChannels Parent API Key"
              />
              <button
                type="button"
                onClick={() =>
                  connectMailchannels.mutate({
                    tenantId: activeTenantId,
                    accountId: mailchannelsAccountId,
                    parentApiKey: mailchannelsApiKey,
                  })
                }
                disabled={
                  connectMailchannels.isPending ||
                  mailchannelsAccountId.length === 0 ||
                  mailchannelsApiKey.length === 0
                }
              >
                Save MailChannels Connection
              </button>
            </div>

            <h3>AgentMail</h3>
            <div className="form-grid">
              <input
                value={agentmailApiKey}
                onChange={(event) => setAgentmailApiKey(event.target.value)}
                placeholder="AgentMail API Key"
              />
              <button
                type="button"
                onClick={() =>
                  connectAgentmail.mutate({
                    tenantId: activeTenantId,
                    apiKey: agentmailApiKey,
                  })
                }
                disabled={connectAgentmail.isPending || agentmailApiKey.length === 0}
              >
                Save AgentMail Connection
              </button>
            </div>
          </>
        )}
      </article>
    </section>
  );
}
