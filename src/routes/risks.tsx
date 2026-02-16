import { useEffect, useMemo, useRef, useState } from "react";

import { useActiveRisk } from "../hooks/use-active-risk";
import { trpc } from "../lib/trpc";

type CredentialFieldId =
  | "mailchannelsAccountId"
  | "mailchannelsParentApiKey"
  | "agentmailApiKey";

type CredentialFeedbackTone = "idle" | "validating" | "success" | "error";

type CredentialFeedbackState = Record<CredentialFieldId, CredentialFeedbackTone>;
type CredentialPreviewOverrides = Partial<Record<CredentialFieldId, string | null>>;

interface MailchannelsMutationInput {
  riskId: string;
  accountId?: string;
  parentApiKey?: string;
}

const VALIDATION_FEEDBACK_DURATION_MS = 1400;
const VALIDATION_ERROR_FEEDBACK_DURATION_MS = VALIDATION_FEEDBACK_DURATION_MS * 3;
const CREDENTIAL_PREVIEW_PREFIX_LENGTH = 6;

const INITIAL_FEEDBACK_STATE: CredentialFeedbackState = {
  mailchannelsAccountId: "idle",
  mailchannelsParentApiKey: "idle",
  agentmailApiKey: "idle",
};

function updateCredentialFields<T>(
  current: Record<CredentialFieldId, T>,
  fields: CredentialFieldId[],
  value: T,
): Record<CredentialFieldId, T> {
  if (fields.length === 0) {
    return current;
  }

  const next = { ...current };
  for (const field of fields) {
    next[field] = value;
  }

  return next;
}

function getMailchannelsValidationFields(
  input: MailchannelsMutationInput,
): CredentialFieldId[] {
  const fields: CredentialFieldId[] = [];

  if (typeof input.accountId === "string") {
    fields.push("mailchannelsAccountId");
  }

  if (typeof input.parentApiKey === "string") {
    fields.push("mailchannelsParentApiKey");
  }

  return fields;
}

function redactedCredentialPreview(value: string): string {
  const normalizedValue = value.trim();
  const prefix = normalizedValue.slice(0, CREDENTIAL_PREVIEW_PREFIX_LENGTH);

  return `${prefix}...`;
}

function credentialFeedbackIcon(tone: CredentialFeedbackTone): string | null {
  if (tone === "success") {
    return "✅";
  }

  return null;
}

function credentialRejectionMessage(fieldId: CredentialFieldId): string {
  if (fieldId === "agentmailApiKey") {
    return "Credential was rejected by AgentMail.";
  }

  return "Credential was rejected by MailChannels.";
}

function getCredentialInputClass(
  inputLocked: boolean,
  tone: CredentialFeedbackTone,
): string {
  const classNames = ["credential-input"];

  if (inputLocked) {
    classNames.push("configured");
  }

  if (tone === "validating") {
    classNames.push("is-validating");
  }

  if (tone === "success") {
    classNames.push("is-verified", "has-feedback-icon");
  }

  if (tone === "error") {
    classNames.push("is-invalid");
  }

  return classNames.join(" ");
}

export function RisksRoute() {
  const { activeRiskId, setActiveRiskId } = useActiveRisk();
  const [riskName, setRiskName] = useState("");
  const [mailchannelsAccountId, setMailchannelsAccountId] = useState("");
  const [mailchannelsApiKey, setMailchannelsApiKey] = useState("");
  const [agentmailApiKey, setAgentmailApiKey] = useState("");
  const [mailchannelsAccountIdEditing, setMailchannelsAccountIdEditing] = useState(false);
  const [mailchannelsApiKeyEditing, setMailchannelsApiKeyEditing] = useState(false);
  const [agentmailApiKeyEditing, setAgentmailApiKeyEditing] = useState(false);
  const [mailchannelsAccountIdForceEntry, setMailchannelsAccountIdForceEntry] = useState(false);
  const [mailchannelsApiKeyForceEntry, setMailchannelsApiKeyForceEntry] = useState(false);
  const [agentmailApiKeyForceEntry, setAgentmailApiKeyForceEntry] = useState(false);
  const [riskSuccess, setRiskSuccess] = useState<string | null>(null);
  const [credentialFeedback, setCredentialFeedback] = useState<CredentialFeedbackState>(
    INITIAL_FEEDBACK_STATE,
  );
  const [credentialPreviewOverrides, setCredentialPreviewOverrides] =
    useState<CredentialPreviewOverrides>({});

  const mailchannelsSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentmailSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMailchannelsSettleTimeout = () => {
    if (!mailchannelsSettleTimeoutRef.current) {
      return;
    }

    clearTimeout(mailchannelsSettleTimeoutRef.current);
    mailchannelsSettleTimeoutRef.current = null;
  };

  const clearAgentmailSettleTimeout = () => {
    if (!agentmailSettleTimeoutRef.current) {
      return;
    }

    clearTimeout(agentmailSettleTimeoutRef.current);
    agentmailSettleTimeoutRef.current = null;
  };

  const utils = trpc.useUtils();
  const risks = trpc.risks.list.useQuery();
  const providerStatus = trpc.risks.providerStatus.useQuery(
    { riskId: activeRiskId ?? "" },
    { enabled: Boolean(activeRiskId) },
  );

  const createRisk = trpc.risks.create.useMutation({
    onMutate: () => {
      setRiskSuccess(null);
    },
    onSuccess: async (result, input) => {
      await utils.risks.list.invalidate();
      setActiveRiskId(result.riskId);
      setRiskName("");
      setRiskSuccess(`Risk "${input.name.trim()}" created.`);
    },
  });

  const connectMailchannels = trpc.risks.connectMailchannels.useMutation({
    onMutate: (input) => {
      const fields = getMailchannelsValidationFields(input);
      clearMailchannelsSettleTimeout();
      setCredentialFeedback((current) =>
        updateCredentialFields(current, fields, "validating"),
      );
    },
    onSuccess: async (_, input) => {
      const fields = getMailchannelsValidationFields(input);

      await Promise.all([
        utils.logs.audit.invalidate(),
        utils.risks.providerStatus.invalidate({ riskId: input.riskId }),
      ]);

      setCredentialFeedback((current) =>
        updateCredentialFields(current, fields, "success"),
      );

      setCredentialPreviewOverrides((current) => {
        const next = { ...current };

        if (typeof input.accountId === "string") {
          next.mailchannelsAccountId = redactedCredentialPreview(input.accountId);
        }

        if (typeof input.parentApiKey === "string") {
          next.mailchannelsParentApiKey = redactedCredentialPreview(
            input.parentApiKey,
          );
        }

        return next;
      });

      clearMailchannelsSettleTimeout();
      mailchannelsSettleTimeoutRef.current = setTimeout(() => {
        setCredentialFeedback((current) =>
          updateCredentialFields(current, fields, "idle"),
        );

        if (fields.includes("mailchannelsAccountId")) {
          setMailchannelsAccountId("");
          setMailchannelsAccountIdEditing(false);
          setMailchannelsAccountIdForceEntry(false);
        }

        if (fields.includes("mailchannelsParentApiKey")) {
          setMailchannelsApiKey("");
          setMailchannelsApiKeyEditing(false);
          setMailchannelsApiKeyForceEntry(false);
        }

        mailchannelsSettleTimeoutRef.current = null;
      }, VALIDATION_FEEDBACK_DURATION_MS);
    },
    onError: (_, input) => {
      const fields = getMailchannelsValidationFields(input);
      clearMailchannelsSettleTimeout();

      setCredentialFeedback((current) =>
        updateCredentialFields(current, fields, "error"),
      );

      mailchannelsSettleTimeoutRef.current = setTimeout(() => {
        setCredentialFeedback((current) =>
          updateCredentialFields(current, fields, "idle"),
        );

        if (fields.includes("mailchannelsAccountId")) {
          setMailchannelsAccountId("");
          setMailchannelsAccountIdEditing(true);
          setMailchannelsAccountIdForceEntry(true);
        }

        if (fields.includes("mailchannelsParentApiKey")) {
          setMailchannelsApiKey("");
          setMailchannelsApiKeyEditing(true);
          setMailchannelsApiKeyForceEntry(true);
        }

        mailchannelsSettleTimeoutRef.current = null;
      }, VALIDATION_ERROR_FEEDBACK_DURATION_MS);
    },
  });

  const connectAgentmail = trpc.risks.connectAgentmail.useMutation({
    onMutate: () => {
      clearAgentmailSettleTimeout();
      setCredentialFeedback((current) => ({
        ...current,
        agentmailApiKey: "validating",
      }));
    },
    onSuccess: async (_, input) => {
      await Promise.all([
        utils.logs.audit.invalidate(),
        utils.risks.providerStatus.invalidate({ riskId: input.riskId }),
      ]);

      setCredentialFeedback((current) => ({
        ...current,
        agentmailApiKey: "success",
      }));

      setCredentialPreviewOverrides((current) => ({
        ...current,
        agentmailApiKey: redactedCredentialPreview(input.apiKey),
      }));

      clearAgentmailSettleTimeout();
      agentmailSettleTimeoutRef.current = setTimeout(() => {
        setCredentialFeedback((current) => ({
          ...current,
          agentmailApiKey: "idle",
        }));
        setAgentmailApiKey("");
        setAgentmailApiKeyEditing(false);
        setAgentmailApiKeyForceEntry(false);
        agentmailSettleTimeoutRef.current = null;
      }, VALIDATION_FEEDBACK_DURATION_MS);
    },
    onError: () => {
      clearAgentmailSettleTimeout();

      setCredentialFeedback((current) => ({
        ...current,
        agentmailApiKey: "error",
      }));

      agentmailSettleTimeoutRef.current = setTimeout(() => {
        setCredentialFeedback((current) => ({
          ...current,
          agentmailApiKey: "idle",
        }));
        setAgentmailApiKey("");
        setAgentmailApiKeyEditing(true);
        setAgentmailApiKeyForceEntry(true);
        agentmailSettleTimeoutRef.current = null;
      }, VALIDATION_ERROR_FEEDBACK_DURATION_MS);
    },
  });

  const createRiskDisabledReason = useMemo(() => {
    if (riskName.trim().length < 2) {
      return "Enter a risk name with at least 2 characters.";
    }

    return null;
  }, [riskName]);

  const providerDisabledReason = useMemo(() => {
    if (!activeRiskId) {
      return "Select a risk first.";
    }

    return null;
  }, [activeRiskId]);

  const selectedRisk = useMemo(() => {
    if (!risks.data || !activeRiskId) {
      return null;
    }

    return risks.data.find((risk) => risk.id === activeRiskId) ?? null;
  }, [risks.data, activeRiskId]);

  const hasRisks = (risks.data?.length ?? 0) > 0;
  const showFirstRiskForm = !risks.isLoading && !risks.error && !hasRisks;

  useEffect(() => {
    return () => {
      clearMailchannelsSettleTimeout();
      clearAgentmailSettleTimeout();
    };
  }, []);

  useEffect(() => {
    clearMailchannelsSettleTimeout();
    clearAgentmailSettleTimeout();

    setMailchannelsAccountId("");
    setMailchannelsApiKey("");
    setAgentmailApiKey("");

    setMailchannelsAccountIdEditing(false);
    setMailchannelsApiKeyEditing(false);
    setAgentmailApiKeyEditing(false);

    setMailchannelsAccountIdForceEntry(false);
    setMailchannelsApiKeyForceEntry(false);
    setAgentmailApiKeyForceEntry(false);

    setCredentialFeedback(INITIAL_FEEDBACK_STATE);
    setCredentialPreviewOverrides({});
  }, [activeRiskId]);

  const mailchannelsAccountIdPreview =
    credentialPreviewOverrides.mailchannelsAccountId ??
    providerStatus.data?.mailchannelsAccountId ??
    null;
  const mailchannelsParentApiKeyPreview =
    credentialPreviewOverrides.mailchannelsParentApiKey ??
    providerStatus.data?.mailchannelsParentApiKey ??
    null;
  const agentmailApiKeyPreview =
    credentialPreviewOverrides.agentmailApiKey ??
    providerStatus.data?.agentmailApiKey ??
    null;

  const isMailchannelsAccountIdConfigured = Boolean(mailchannelsAccountIdPreview);
  const isMailchannelsParentApiKeyConfigured = Boolean(
    mailchannelsParentApiKeyPreview,
  );
  const isAgentmailApiKeyConfigured = Boolean(agentmailApiKeyPreview);

  const mailchannelsAccountIdTone = credentialFeedback.mailchannelsAccountId;
  const mailchannelsParentApiKeyTone = credentialFeedback.mailchannelsParentApiKey;
  const agentmailApiKeyTone = credentialFeedback.agentmailApiKey;

  const mailchannelsAccountIdFeedbackIcon = credentialFeedbackIcon(
    mailchannelsAccountIdTone,
  );
  const mailchannelsParentApiKeyFeedbackIcon = credentialFeedbackIcon(
    mailchannelsParentApiKeyTone,
  );
  const agentmailApiKeyFeedbackIcon = credentialFeedbackIcon(agentmailApiKeyTone);

  const isMailchannelsAccountIdLocked =
    isMailchannelsAccountIdConfigured &&
    !mailchannelsAccountIdEditing &&
    !mailchannelsAccountIdForceEntry;
  const isMailchannelsParentApiKeyLocked =
    isMailchannelsParentApiKeyConfigured &&
    !mailchannelsApiKeyEditing &&
    !mailchannelsApiKeyForceEntry;
  const isAgentmailApiKeyLocked =
    isAgentmailApiKeyConfigured && !agentmailApiKeyEditing && !agentmailApiKeyForceEntry;

  const isMailchannelsAccountIdFrozen =
    isMailchannelsAccountIdLocked || mailchannelsAccountIdTone !== "idle";
  const isMailchannelsParentApiKeyFrozen =
    isMailchannelsParentApiKeyLocked || mailchannelsParentApiKeyTone !== "idle";
  const isAgentmailApiKeyFrozen =
    isAgentmailApiKeyLocked || agentmailApiKeyTone !== "idle";

  const mailchannelsNeedsAccountIdInput =
    !isMailchannelsAccountIdConfigured ||
    mailchannelsAccountIdEditing ||
    mailchannelsAccountIdForceEntry;
  const mailchannelsNeedsApiKeyInput =
    !isMailchannelsParentApiKeyConfigured ||
    mailchannelsApiKeyEditing ||
    mailchannelsApiKeyForceEntry;

  const mailchannelsAccountIdReady =
    !mailchannelsNeedsAccountIdInput || mailchannelsAccountId.trim().length > 0;
  const mailchannelsApiKeyReady =
    !mailchannelsNeedsApiKeyInput || mailchannelsApiKey.trim().length > 0;

  const mailchannelsHasPendingChanges =
    (mailchannelsNeedsAccountIdInput && mailchannelsAccountId.trim().length > 0) ||
    (mailchannelsNeedsApiKeyInput && mailchannelsApiKey.trim().length > 0);

  const agentmailNeedsApiKeyInput =
    !isAgentmailApiKeyConfigured || agentmailApiKeyEditing || agentmailApiKeyForceEntry;
  const agentmailHasPendingChanges =
    agentmailNeedsApiKeyInput && agentmailApiKey.trim().length > 0;

  const mailchannelsFeedbackVisible =
    mailchannelsAccountIdTone !== "idle" || mailchannelsParentApiKeyTone !== "idle";
  const agentmailFeedbackVisible = agentmailApiKeyTone !== "idle";

  const mailchannelsValidationInFlight =
    mailchannelsAccountIdTone === "validating" ||
    mailchannelsParentApiKeyTone === "validating" ||
    connectMailchannels.isPending;
  const agentmailValidationInFlight =
    agentmailApiKeyTone === "validating" || connectAgentmail.isPending;

  const beginMailchannelsAccountIdEdit = () => {
    if (!isMailchannelsAccountIdLocked || mailchannelsAccountIdTone !== "idle") {
      return;
    }

    setMailchannelsAccountId("");
    setMailchannelsAccountIdEditing(true);
    setMailchannelsAccountIdForceEntry(false);
  };

  const beginMailchannelsApiKeyEdit = () => {
    if (!isMailchannelsParentApiKeyLocked || mailchannelsParentApiKeyTone !== "idle") {
      return;
    }

    setMailchannelsApiKey("");
    setMailchannelsApiKeyEditing(true);
    setMailchannelsApiKeyForceEntry(false);
  };

  const beginAgentmailApiKeyEdit = () => {
    if (!isAgentmailApiKeyLocked || agentmailApiKeyTone !== "idle") {
      return;
    }

    setAgentmailApiKey("");
    setAgentmailApiKeyEditing(true);
    setAgentmailApiKeyForceEntry(false);
  };

  const restoreMailchannelsAccountIdPreview = () => {
    if (
      mailchannelsAccountIdEditing &&
      !mailchannelsAccountIdForceEntry &&
      mailchannelsAccountId.trim().length === 0 &&
      mailchannelsAccountIdTone === "idle"
    ) {
      setMailchannelsAccountIdEditing(false);
    }
  };

  const restoreMailchannelsApiKeyPreview = () => {
    if (
      mailchannelsApiKeyEditing &&
      !mailchannelsApiKeyForceEntry &&
      mailchannelsApiKey.trim().length === 0 &&
      mailchannelsParentApiKeyTone === "idle"
    ) {
      setMailchannelsApiKeyEditing(false);
    }
  };

  const restoreAgentmailApiKeyPreview = () => {
    if (
      agentmailApiKeyEditing &&
      !agentmailApiKeyForceEntry &&
      agentmailApiKey.trim().length === 0 &&
      agentmailApiKeyTone === "idle"
    ) {
      setAgentmailApiKeyEditing(false);
    }
  };

  return (
    <section className="stack">
      <article className="panel">
        <div className="section-header">
          <h2>Risks 🦞🦞🦞</h2>
          <p className="muted-copy">
            Risks isolate users, credentials, and operational activity.
          </p>
        </div>

        {risks.isLoading && (
          <p className="status-pill info" role="status" aria-live="polite">
            Loading risks...
          </p>
        )}
        {risks.error && (
          <div className="status-banner error" role="alert">
            <p>Could not load risks: {risks.error.message}</p>
            <div className="status-actions">
              <button type="button" className="button-secondary" onClick={() => risks.refetch()}>
                Retry
              </button>
            </div>
          </div>
        )}
        {riskSuccess && (
          <p className="status-pill success" role="status" aria-live="polite">
            {riskSuccess}
          </p>
        )}
        {showFirstRiskForm && createRisk.error && (
          <p className="status-pill error" role="alert">
            {createRisk.error.message}
          </p>
        )}

        {hasRisks && (
          <div className="risk-summary">
            {selectedRisk ? (
              <div className="risk-summary-row">
                <span className="risk-summary-name">{selectedRisk.name}</span>
                <span className="tag">{selectedRisk.role}</span>
              </div>
            ) : (
              <p className="hint-message">
                Select a risk from the header risk menu to continue.
              </p>
            )}
          </div>
        )}

        {showFirstRiskForm && (
          <div className="form-grid">
            <p className="hint-message">
              No risks yet. Create your first risk to begin managing providers.
            </p>
            <label>
              New risk name
              <input
                value={riskName}
                onChange={(event) => {
                  setRiskSuccess(null);
                  setRiskName(event.target.value);
                }}
                placeholder="acme-mail"
              />
            </label>
            {createRiskDisabledReason && (
              <p className="hint-message">{createRiskDisabledReason}</p>
            )}
            <div className="button-row">
              <button
                type="button"
                onClick={() => createRisk.mutate({ name: riskName.trim() })}
                disabled={createRisk.isPending || createRiskDisabledReason !== null}
              >
                {createRisk.isPending ? "Creating Risk..." : "Create Risk"}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setRiskName("")}
                disabled={createRisk.isPending || riskName.length === 0}
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </article>

      <article className="panel">
        <div className="section-header">
          <h2>Provider Connections</h2>
          <p className="muted-copy">
            Store provider credentials for the selected risk only.
          </p>
        </div>

        {providerDisabledReason && <p className="hint-message">{providerDisabledReason}</p>}
        {!providerDisabledReason && providerStatus.isLoading && (
          <p className="status-pill info" role="status" aria-live="polite">
            Loading stored provider credentials...
          </p>
        )}
        {providerStatus.error && (
          <p className="status-pill error" role="alert">
            {providerStatus.error.message}
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
                <div className="credential-input-shell">
                  {mailchannelsAccountIdFeedbackIcon && (
                    <span className="credential-feedback-icon" aria-hidden="true">
                      {mailchannelsAccountIdFeedbackIcon}
                    </span>
                  )}
                  <input
                    className={getCredentialInputClass(
                      isMailchannelsAccountIdLocked,
                      mailchannelsAccountIdTone,
                    )}
                    value={
                      mailchannelsAccountIdTone === "error"
                        ? `❌ ${credentialRejectionMessage("mailchannelsAccountId")}`
                        : isMailchannelsAccountIdLocked
                          ? (mailchannelsAccountIdPreview ?? "")
                          : mailchannelsAccountId
                    }
                    onChange={(event) => {
                      setMailchannelsAccountId(event.target.value);
                    }}
                    onClick={beginMailchannelsAccountIdEdit}
                    onBlur={restoreMailchannelsAccountIdPreview}
                    readOnly={isMailchannelsAccountIdFrozen}
                    title={
                      isMailchannelsAccountIdLocked
                        ? "Click to replace this credential."
                        : undefined
                    }
                    placeholder={
                      mailchannelsAccountIdEditing || mailchannelsAccountIdForceEntry
                        ? "Enter a new MailChannels account id"
                        : "MailChannels account ID"
                    }
                  />
                </div>
              </label>
              {(mailchannelsAccountIdEditing || mailchannelsAccountIdForceEntry) &&
                isMailchannelsAccountIdConfigured && (
                <p className="hint-message">Enter a new MailChannels account id.</p>
              )}

              <label>
                Parent API key
                <div className="credential-input-shell">
                  {mailchannelsParentApiKeyFeedbackIcon && (
                    <span className="credential-feedback-icon" aria-hidden="true">
                      {mailchannelsParentApiKeyFeedbackIcon}
                    </span>
                  )}
                  <input
                    className={getCredentialInputClass(
                      isMailchannelsParentApiKeyLocked,
                      mailchannelsParentApiKeyTone,
                    )}
                    value={
                      mailchannelsParentApiKeyTone === "error"
                        ? `❌ ${credentialRejectionMessage("mailchannelsParentApiKey")}`
                        : isMailchannelsParentApiKeyLocked
                          ? (mailchannelsParentApiKeyPreview ?? "")
                          : mailchannelsApiKey
                    }
                    onChange={(event) => {
                      setMailchannelsApiKey(event.target.value);
                    }}
                    onClick={beginMailchannelsApiKeyEdit}
                    onBlur={restoreMailchannelsApiKeyPreview}
                    readOnly={isMailchannelsParentApiKeyFrozen}
                    title={
                      isMailchannelsParentApiKeyLocked
                        ? "Click to replace this credential."
                        : undefined
                    }
                    placeholder={
                      mailchannelsApiKeyEditing || mailchannelsApiKeyForceEntry
                        ? "Enter a new MailChannels parent API key"
                        : "MailChannels parent API key"
                    }
                  />
                </div>
              </label>
              {(mailchannelsApiKeyEditing || mailchannelsApiKeyForceEntry) &&
                isMailchannelsParentApiKeyConfigured && (
                <p className="hint-message">Enter a new MailChannels parent API key.</p>
              )}

              <button
                type="button"
                onClick={() =>
                  connectMailchannels.mutate({
                    riskId: activeRiskId ?? "",
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
                  mailchannelsFeedbackVisible ||
                  !mailchannelsAccountIdReady ||
                  !mailchannelsApiKeyReady ||
                  !mailchannelsHasPendingChanges
                }
              >
                {mailchannelsValidationInFlight
                  ? "Validating MailChannels..."
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
                <div className="credential-input-shell">
                  {agentmailApiKeyFeedbackIcon && (
                    <span className="credential-feedback-icon" aria-hidden="true">
                      {agentmailApiKeyFeedbackIcon}
                    </span>
                  )}
                  <input
                    className={getCredentialInputClass(
                      isAgentmailApiKeyLocked,
                      agentmailApiKeyTone,
                    )}
                    value={
                      agentmailApiKeyTone === "error"
                        ? `❌ ${credentialRejectionMessage("agentmailApiKey")}`
                        : isAgentmailApiKeyLocked
                          ? (agentmailApiKeyPreview ?? "")
                          : agentmailApiKey
                    }
                    onChange={(event) => {
                      setAgentmailApiKey(event.target.value);
                    }}
                    onClick={beginAgentmailApiKeyEdit}
                    onBlur={restoreAgentmailApiKeyPreview}
                    readOnly={isAgentmailApiKeyFrozen}
                    title={
                      isAgentmailApiKeyLocked
                        ? "Click to replace this credential."
                        : undefined
                    }
                    placeholder={
                      agentmailApiKeyEditing || agentmailApiKeyForceEntry
                        ? "Enter a new AgentMail API key"
                        : "AgentMail API key"
                    }
                  />
                </div>
              </label>
              {(agentmailApiKeyEditing || agentmailApiKeyForceEntry) &&
                isAgentmailApiKeyConfigured && (
                <p className="hint-message">Enter a new AgentMail API key.</p>
              )}

              <button
                type="button"
                onClick={() =>
                  connectAgentmail.mutate({
                    riskId: activeRiskId ?? "",
                    apiKey: agentmailApiKey.trim(),
                  })
                }
                disabled={
                  providerDisabledReason !== null ||
                  connectAgentmail.isPending ||
                  agentmailFeedbackVisible ||
                  !agentmailHasPendingChanges
                }
              >
                {agentmailValidationInFlight
                  ? "Validating AgentMail..."
                  : "Save AgentMail"}
              </button>
            </div>
          </section>
        </div>
      </article>
    </section>
  );
}
