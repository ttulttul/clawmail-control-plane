import { useActiveTenant } from "../hooks/use-active-tenant";
import { trpc } from "../lib/trpc";

export function WebhooksRoute() {
  const { activeTenantId } = useActiveTenant();

  const validate = trpc.mailchannels.validateWebhook.useMutation();

  if (!activeTenantId) {
    return <p>Select a tenant to validate webhooks.</p>;
  }

  return (
    <section className="panel">
      <h2>MailChannels Webhooks</h2>
      <button
        type="button"
        onClick={() => validate.mutate({ tenantId: activeTenantId })}
        disabled={validate.isPending}
      >
        Validate MailChannels Webhook
      </button>
      {validate.data && (
        <p>
          Result: {validate.data.ok ? "ok" : "failed"} - {validate.data.message}
        </p>
      )}
      {validate.error && <p className="error-message">{validate.error.message}</p>}
    </section>
  );
}
