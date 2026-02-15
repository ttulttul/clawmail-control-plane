import type {
  AgentMailConnector,
  AgentmailDomain,
  AgentmailInbox,
  AgentmailPod,
  MailChannelsConnector,
  MailchannelsApiKey,
  MailchannelsSendResponse,
} from "./types.js";
import { ProviderHttpError, type ProviderName } from "./provider-error.js";

function ensureOk(
  provider: ProviderName,
  path: string,
  response: Response,
  body: string,
): void {
  if (!response.ok) {
    throw new ProviderHttpError({
      provider,
      status: response.status,
      path,
      body,
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringByCandidateKeys(
  value: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string") {
      return candidate;
    }
  }

  return null;
}

export class LiveMailChannelsConnector implements MailChannelsConnector {
  public constructor(private readonly baseUrl: string) {}

  private async request<T>(
    path: string,
    init: RequestInit,
    apiKey: string,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        ...init.headers,
      },
    });

    const text = await response.text();
    ensureOk("mailchannels", path, response, text);

    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  async listSubaccounts(input: { parentApiKey: string }): Promise<Array<{ handle: string }>> {
    const response = await this.request<unknown>(
      "/sub-account",
      { method: "GET" },
      input.parentApiKey,
    );

    const entries = Array.isArray(response)
      ? response
      : isRecord(response) && Array.isArray(response.sub_accounts)
        ? response.sub_accounts
        : isRecord(response) && Array.isArray(response.subaccounts)
          ? response.subaccounts
          : [];

    const subaccounts: Array<{ handle: string }> = [];

    for (const entry of entries) {
      if (!isRecord(entry)) {
        continue;
      }

      const handle = getStringByCandidateKeys(entry, [
        "customer_handle",
        "handle",
        "subaccount_handle",
      ]);

      if (!handle) {
        continue;
      }

      subaccounts.push({ handle });
    }

    return subaccounts;
  }

  async createSubaccount(input: { handle: string; parentApiKey: string }): Promise<void> {
    await this.request("/sub-account", {
      method: "POST",
      body: JSON.stringify({ customer_handle: input.handle }),
    }, input.parentApiKey);
  }

  async setSubaccountLimit(input: {
    parentApiKey: string;
    handle: string;
    limit: number;
  }): Promise<void> {
    await this.request(
      `/sub-account/${input.handle}/limit`,
      {
        method: "POST",
        body: JSON.stringify({ limit: input.limit }),
      },
      input.parentApiKey,
    );
  }

  async deleteSubaccountLimit(input: {
    parentApiKey: string;
    handle: string;
  }): Promise<void> {
    await this.request(
      `/sub-account/${input.handle}/limit`,
      { method: "DELETE" },
      input.parentApiKey,
    );
  }

  async suspendSubaccount(input: {
    parentApiKey: string;
    handle: string;
  }): Promise<void> {
    await this.request(
      `/sub-account/${input.handle}/suspend`,
      { method: "POST" },
      input.parentApiKey,
    );
  }

  async activateSubaccount(input: {
    parentApiKey: string;
    handle: string;
  }): Promise<void> {
    await this.request(
      `/sub-account/${input.handle}/activate`,
      { method: "POST" },
      input.parentApiKey,
    );
  }

  async createSubaccountApiKey(input: {
    parentApiKey: string;
    handle: string;
  }): Promise<MailchannelsApiKey> {
    const response = await this.request<{
      id: string;
      value: string;
      redacted: string;
    }>(
      `/sub-account/${input.handle}/api-key`,
      { method: "POST" },
      input.parentApiKey,
    );

    return {
      providerKeyId: response.id,
      keyValue: response.value,
      redactedValue: response.redacted,
    };
  }

  async deleteSubaccountApiKey(input: {
    parentApiKey: string;
    handle: string;
    providerKeyId: string;
  }): Promise<void> {
    await this.request(
      `/sub-account/${input.handle}/api-key/${input.providerKeyId}`,
      { method: "DELETE" },
      input.parentApiKey,
    );
  }

  async retrieveSubaccountUsage(input: {
    parentApiKey: string;
    handle: string;
  }): Promise<{ usage: number }> {
    const response = await this.request<{ usage: number }>(
      `/sub-account/${input.handle}/usage`,
      { method: "GET" },
      input.parentApiKey,
    );

    return { usage: response.usage };
  }

  async validateWebhook(input: { parentApiKey: string }): Promise<{
    ok: boolean;
    message: string;
  }> {
    const response = await this.request<{ ok: boolean; message: string }>(
      "/webhook/validate",
      { method: "POST" },
      input.parentApiKey,
    );

    return response;
  }

  async sendEmail(input: {
    parentOrSubaccountApiKey: string;
    accountId: string;
    from: string;
    to: string[];
    subject: string;
    textBody: string;
    htmlBody?: string;
    headers?: Record<string, string>;
  }): Promise<MailchannelsSendResponse> {
    const response = await this.request<{ request_id: string; status: string }>(
      "/send",
      {
        method: "POST",
        body: JSON.stringify({
          to: input.to,
          from: input.from,
          subject: input.subject,
          text: input.textBody,
          html: input.htmlBody,
          headers: input.headers,
          customer_handle: input.accountId,
        }),
      },
      input.parentOrSubaccountApiKey,
    );

    return {
      requestId: response.request_id,
      status:
        response.status === "accepted" || response.status === "rejected"
          ? response.status
          : "queued",
    };
  }
}

export class LiveAgentMailConnector implements AgentMailConnector {
  public constructor(private readonly baseUrl: string) {}

  private async request<T>(
    path: string,
    init: RequestInit,
    apiKey: string,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        ...init.headers,
      },
    });

    const text = await response.text();
    ensureOk("agentmail", path, response, text);

    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  async listPods(input: { apiKey: string }): Promise<Array<{ podId: string }>> {
    const response = await this.request<unknown>(
      "/pods",
      { method: "GET" },
      input.apiKey,
    );

    const podEntries = Array.isArray(response)
      ? response
      : isRecord(response) && Array.isArray(response.pods)
        ? response.pods
        : [];

    const pods: Array<{ podId: string }> = [];

    for (const pod of podEntries) {
      if (!isRecord(pod)) {
        continue;
      }

      const podId = getStringByCandidateKeys(pod, ["pod_id", "id"]);
      if (!podId) {
        continue;
      }

      pods.push({ podId });
    }

    return pods;
  }

  async ensurePod(input: { apiKey: string; name: string }): Promise<AgentmailPod> {
    const pod = await this.request<{ id: string }>(
      "/pods",
      {
        method: "POST",
        body: JSON.stringify({ name: input.name }),
      },
      input.apiKey,
    );

    return { podId: pod.id };
  }

  async createDomain(input: {
    apiKey: string;
    podId: string;
    domain: string;
  }): Promise<AgentmailDomain> {
    const domain = await this.request<{
      domain: string;
      status: string;
      dns_records: string[];
    }>(
      `/pods/${input.podId}/domains`,
      {
        method: "POST",
        body: JSON.stringify({ domain: input.domain }),
      },
      input.apiKey,
    );

    return {
      domain: domain.domain,
      status: domain.status,
      dnsRecords: domain.dns_records,
    };
  }

  async createInbox(input: {
    apiKey: string;
    podId: string;
    username: string;
    domain?: string;
  }): Promise<AgentmailInbox> {
    const inbox = await this.request<{
      id: string;
      username: string;
      domain: string;
    }>(
      `/pods/${input.podId}/inboxes`,
      {
        method: "POST",
        body: JSON.stringify({ username: input.username, domain: input.domain }),
      },
      input.apiKey,
    );

    return {
      inboxId: inbox.id,
      username: inbox.username,
      domain: inbox.domain,
    };
  }

  async listThreads(input: {
    apiKey: string;
    inboxId: string;
  }): Promise<Array<{ id: string; subject: string; lastMessageAt: string }>> {
    const response = await this.request<{
      threads: Array<{ id: string; subject: string; last_message_at: string }>;
    }>(`/inboxes/${input.inboxId}/threads`, { method: "GET" }, input.apiKey);

    return response.threads.map((thread) => ({
      id: thread.id,
      subject: thread.subject,
      lastMessageAt: thread.last_message_at,
    }));
  }

  async getMessage(input: {
    apiKey: string;
    inboxId: string;
    messageId: string;
  }): Promise<{ id: string; subject: string; text: string; from: string }> {
    const message = await this.request<{
      id: string;
      subject: string;
      text: string;
      from: string;
    }>(
      `/inboxes/${input.inboxId}/messages/${input.messageId}`,
      { method: "GET" },
      input.apiKey,
    );

    return message;
  }

  async replyToMessage(input: {
    apiKey: string;
    inboxId: string;
    messageId: string;
    body: string;
  }): Promise<{ id: string }> {
    const response = await this.request<{ id: string }>(
      `/inboxes/${input.inboxId}/messages/${input.messageId}/reply`,
      {
        method: "POST",
        body: JSON.stringify({ body: input.body }),
      },
      input.apiKey,
    );

    return response;
  }
}
