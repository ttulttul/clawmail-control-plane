import { useState } from "react";

import { useActiveTenant } from "../hooks/use-active-tenant";
import { trpc } from "../lib/trpc";

export function DomainsRoute() {
  const { activeTenantId } = useActiveTenant();
  const [podName, setPodName] = useState("default-pod");
  const [podId, setPodId] = useState("");
  const [domain, setDomain] = useState("");

  const utils = trpc.useUtils();

  const domains = trpc.agentmail.listDomains.useQuery(
    { tenantId: activeTenantId ?? "" },
    { enabled: Boolean(activeTenantId) },
  );

  const ensurePod = trpc.agentmail.ensurePod.useMutation({
    onSuccess: async (result) => {
      setPodId(result.podId);
      await utils.agentmail.listDomains.invalidate();
    },
  });

  const createDomain = trpc.agentmail.createDomain.useMutation({
    onSuccess: async () => {
      await utils.agentmail.listDomains.invalidate();
      setDomain("");
    },
  });

  if (!activeTenantId) {
    return <p>Select a tenant to manage AgentMail domains.</p>;
  }

  return (
    <section className="stack">
      <article className="panel">
        <h2>Pod</h2>
        <div className="button-row">
          <input
            value={podName}
            onChange={(event) => setPodName(event.target.value)}
            placeholder="Pod name"
          />
          <button
            type="button"
            onClick={() => ensurePod.mutate({ tenantId: activeTenantId, podName })}
          >
            Ensure Pod
          </button>
        </div>
        {podId && <p>Active pod: {podId}</p>}
      </article>

      <article className="panel">
        <h2>Domains</h2>
        <div className="button-row">
          <input
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="mail.example.com"
          />
          <button
            type="button"
            onClick={() =>
              createDomain.mutate({
                tenantId: activeTenantId,
                podId,
                domain,
              })
            }
            disabled={domain.length < 3 || podId.length === 0}
          >
            Create Domain
          </button>
        </div>

        <ul>
          {domains.data?.map((item) => (
            <li key={item.id}>
              <strong>{item.domain}</strong> ({item.status})
              <ul>
                {item.dnsRecords.map((record) => (
                  <li key={record}>{record}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
