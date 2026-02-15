import { randomUUID } from "node:crypto";

import type {
  AgentMailConnector,
  AgentmailDomain,
  AgentmailInbox,
  AgentmailPod,
  MailChannelsConnector,
  MailchannelsApiKey,
  MailchannelsSendResponse,
} from "./types.js";

function redactKey(value: string): string {
  if (value.length <= 6) {
    return "******";
  }

  return `${value.slice(0, 4)}...${value.slice(-2)}`;
}

export class MockMailChannelsConnector implements MailChannelsConnector {
  async createSubaccount(): Promise<void> {
    return Promise.resolve();
  }

  async setSubaccountLimit(): Promise<void> {
    return Promise.resolve();
  }

  async deleteSubaccountLimit(): Promise<void> {
    return Promise.resolve();
  }

  async suspendSubaccount(): Promise<void> {
    return Promise.resolve();
  }

  async activateSubaccount(): Promise<void> {
    return Promise.resolve();
  }

  async createSubaccountApiKey(): Promise<MailchannelsApiKey> {
    const keyValue = `mc_${randomUUID().replace(/-/g, "")}`;
    return {
      providerKeyId: randomUUID(),
      keyValue,
      redactedValue: redactKey(keyValue),
    };
  }

  async deleteSubaccountApiKey(): Promise<void> {
    return Promise.resolve();
  }

  async retrieveSubaccountUsage(): Promise<{ usage: number }> {
    return { usage: 0 };
  }

  async validateWebhook(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: "Mock webhook validation succeeded." };
  }

  async sendEmail(): Promise<MailchannelsSendResponse> {
    return {
      requestId: randomUUID(),
      status: "queued",
    };
  }
}

export class MockAgentMailConnector implements AgentMailConnector {
  async listPods(): Promise<Array<{ podId: string }>> {
    return [];
  }

  async ensurePod(input: { name: string }): Promise<AgentmailPod> {
    return { podId: `pod_${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` };
  }

  async createDomain(input: { domain: string }): Promise<AgentmailDomain> {
    return {
      domain: input.domain,
      status: "pending_verification",
      dnsRecords: [`TXT _agentmail.${input.domain} value=verify`],
    };
  }

  async createInbox(input: {
    username: string;
    domain?: string;
  }): Promise<AgentmailInbox> {
    return {
      inboxId: randomUUID(),
      username: input.username,
      domain: input.domain ?? "agentmail.to",
    };
  }

  async listThreads(): Promise<Array<{ id: string; subject: string; lastMessageAt: string }>> {
    return [
      {
        id: randomUUID(),
        subject: "Welcome to ClawMail",
        lastMessageAt: new Date().toISOString(),
      },
    ];
  }

  async getMessage(input: { messageId: string }): Promise<{
    id: string;
    subject: string;
    text: string;
    from: string;
  }> {
    return {
      id: input.messageId,
      subject: "Welcome to ClawMail",
      text: "This is a mock message body.",
      from: "hello@example.com",
    };
  }

  async replyToMessage(): Promise<{ id: string }> {
    return { id: randomUUID() };
  }
}
