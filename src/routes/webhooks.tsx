import { useState } from "react";

import { useActiveCast } from "../hooks/use-active-cast";
import { trpc } from "../lib/trpc";

export function WebhooksRoute() {
  const { activeCastId } = useActiveCast();
  const [lastValidatedAt, setLastValidatedAt] = useState<string | null>(null);

  const validate = trpc.mailchannels.validateWebhook.useMutation({
    onSuccess: () => {
      setLastValidatedAt(new Date().toLocaleString());
    },
  });

  if (!activeCastId) {
    return (
      <section className="panel">
        <h2>Select a Cast 🦀🦀🦀</h2>
        <p className="muted-copy">
          Choose a cast to validate MailChannels webhook configuration.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-header">
        <h2>MailChannels Webhook Validation</h2>
        <p className="muted-copy">
          Run a live check to confirm webhook signing and endpoint configuration.
        </p>
      </div>

      {validate.isPending && (
        <p className="status-pill info" role="status" aria-live="polite">
          Validating webhook configuration...
        </p>
      )}
      {validate.error && (
        <p className="status-pill error" role="alert">
          Validation failed: {validate.error.message}
        </p>
      )}
      {validate.data && (
        <p className={`status-pill ${validate.data.ok ? "success" : "error"}`}>
          {validate.data.ok ? "Validation passed." : "Validation failed."}{" "}
          {validate.data.message}
        </p>
      )}
      {lastValidatedAt && (
        <p className="hint-message">Last checked: {lastValidatedAt}</p>
      )}

      <div className="button-row">
        <button
          type="button"
          onClick={() => validate.mutate({ castId: activeCastId })}
          disabled={validate.isPending}
        >
          {validate.isPending ? "Validating..." : "Validate Webhook"}
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            validate.reset();
            setLastValidatedAt(null);
          }}
          disabled={validate.isPending}
        >
          Clear Result
        </button>
      </div>
    </section>
  );
}
