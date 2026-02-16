import { useMemo, useState } from "react";

import { useActiveRisk } from "../hooks/use-active-risk";
import { trpc } from "../lib/trpc";

type NoticeTone = "info" | "success" | "error";

interface RouteNotice {
  tone: NoticeTone;
  message: string;
}

export function DomainsRoute() {
  const { activeRiskId } = useActiveRisk();
  const [podName, setPodName] = useState("default-pod");
  const [podId, setPodId] = useState("");
  const [domain, setDomain] = useState("");
  const [notice, setNotice] = useState<RouteNotice | null>(null);

  const utils = trpc.useUtils();

  const domains = trpc.agentmail.listDomains.useQuery(
    { riskId: activeRiskId ?? "" },
    { enabled: Boolean(activeRiskId) },
  );

  const ensurePod = trpc.agentmail.ensurePod.useMutation({
    onMutate: () => {
      setNotice({ tone: "info", message: "Ensuring pod..." });
    },
    onSuccess: async (result) => {
      setPodId(result.podId);
      await utils.agentmail.listDomains.invalidate();
      setNotice({
        tone: "success",
        message: `Pod ready: ${result.podId}`,
      });
    },
    onError: (error) => {
      setNotice({ tone: "error", message: error.message });
    },
  });

  const createDomain = trpc.agentmail.createDomain.useMutation({
    onMutate: () => {
      setNotice({ tone: "info", message: "Creating domain..." });
    },
    onSuccess: async (_, input) => {
      await utils.agentmail.listDomains.invalidate();
      setDomain("");
      setNotice({
        tone: "success",
        message: `Domain "${input.domain}" created.`,
      });
    },
    onError: (error) => {
      setNotice({ tone: "error", message: error.message });
    },
  });

  const createDomainDisabledReason = useMemo(() => {
    if (podId.trim().length === 0) {
      return "Create or select a pod before adding domains.";
    }

    if (domain.trim().length < 3) {
      return "Enter a valid domain (for example mail.example.com).";
    }

    return null;
  }, [domain, podId]);

  if (!activeRiskId) {
    return (
      <section className="panel">
        <h2>Select a Risk 🦞🦞🦞</h2>
        <p className="muted-copy">
          Choose a risk to manage AgentMail pods and domains.
        </p>
      </section>
    );
  }

  return (
    <section className="stack">
      <article className="panel">
        <div className="section-header">
          <h2>Pod Setup</h2>
          <p className="muted-copy">
            Domains and inboxes are created inside a pod. Ensure a pod first.
          </p>
        </div>

        {notice && (
          <p className={`status-pill ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
            {notice.message}
          </p>
        )}
        <div className="button-row">
          <input
            value={podName}
            onChange={(event) => {
              setNotice(null);
              setPodName(event.target.value);
            }}
            placeholder="default-pod"
          />
          <button
            type="button"
            onClick={() => ensurePod.mutate({ riskId: activeRiskId, podName: podName.trim() })}
            disabled={ensurePod.isPending || podName.trim().length < 2}
          >
            {ensurePod.isPending ? "Ensuring Pod..." : "Ensure Pod"}
          </button>
        </div>
        {podId && <p className="hint-message">Active pod: {podId}</p>}
      </article>

      <article className="panel">
        <div className="section-header">
          <h2>Domains</h2>
          <p className="muted-copy">
            Add domains to the active pod and copy DNS records into your DNS provider.
          </p>
        </div>

        {domains.isLoading && (
          <p className="status-pill info" role="status" aria-live="polite">
            Loading domains...
          </p>
        )}
        {domains.error && (
          <div className="status-banner error" role="alert">
            <p>Could not load domains: {domains.error.message}</p>
            <div className="status-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => domains.refetch()}
              >
                Retry
              </button>
            </div>
          </div>
        )}
        {createDomain.error && (
          <p className="status-pill error" role="alert">
            {createDomain.error.message}
          </p>
        )}

        <div className="form-grid">
          <label>
            Domain
            <input
              value={domain}
              onChange={(event) => {
                setNotice(null);
                setDomain(event.target.value);
              }}
              placeholder="mail.example.com"
            />
          </label>
          {createDomainDisabledReason && <p className="hint-message">{createDomainDisabledReason}</p>}
          <div className="button-row">
            <button
              type="button"
              onClick={() =>
                createDomain.mutate({
                  riskId: activeRiskId,
                  podId: podId.trim(),
                  domain: domain.trim(),
                })
              }
              disabled={createDomain.isPending || createDomainDisabledReason !== null}
            >
              {createDomain.isPending ? "Creating Domain..." : "Create Domain"}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => setDomain("")}
              disabled={createDomain.isPending || domain.length === 0}
            >
              Clear
            </button>
          </div>
        </div>

        <ul className="entity-list domain-list">
          {domains.data?.map((item) => (
            <li key={item.id}>
              <div className="entity-title-row">
                <strong>{item.domain}</strong>
                <span className="tag">{item.status}</span>
              </div>
              <ul className="dns-list">
                {item.dnsRecords.map((record) => (
                  <li key={record}>
                    <code>{record}</code>
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {domains.data?.length === 0 && (
            <li className="empty-message">No domains yet. Create one after ensuring a pod.</li>
          )}
        </ul>
      </article>
    </section>
  );
}
