export interface MailchannelsCreateSubaccountInput {
  handle: string;
  parentApiKey: string;
}

export interface MailchannelsApiKey {
  providerKeyId: string;
  keyValue: string;
  redactedValue: string;
}

export interface MailchannelsSendRequest {
  parentOrSubaccountApiKey: string;
  accountId: string;
  from: string;
  to: string[];
  subject: string;
  textBody: string;
  htmlBody?: string;
  headers?: Record<string, string>;
}

export interface MailchannelsSendResponse {
  requestId: string;
  status: "queued" | "accepted" | "rejected";
}

export interface MailChannelsConnector {
  listSubaccounts: (input: { parentApiKey: string }) => Promise<Array<{ handle: string }>>;
  createSubaccount: (input: MailchannelsCreateSubaccountInput) => Promise<void>;
  setSubaccountLimit: (input: {
    parentApiKey: string;
    handle: string;
    limit: number;
  }) => Promise<void>;
  deleteSubaccountLimit: (input: {
    parentApiKey: string;
    handle: string;
  }) => Promise<void>;
  suspendSubaccount: (input: {
    parentApiKey: string;
    handle: string;
  }) => Promise<void>;
  activateSubaccount: (input: {
    parentApiKey: string;
    handle: string;
  }) => Promise<void>;
  createSubaccountApiKey: (input: {
    parentApiKey: string;
    handle: string;
  }) => Promise<MailchannelsApiKey>;
  deleteSubaccountApiKey: (input: {
    parentApiKey: string;
    handle: string;
    providerKeyId: string;
  }) => Promise<void>;
  retrieveSubaccountUsage: (input: {
    parentApiKey: string;
    handle: string;
  }) => Promise<{ usage: number }>;
  validateWebhook: (input: {
    parentApiKey: string;
  }) => Promise<{ ok: boolean; message: string }>;
  sendEmail: (input: MailchannelsSendRequest) => Promise<MailchannelsSendResponse>;
}

export interface AgentmailPod {
  podId: string;
}

export interface AgentmailDomain {
  domain: string;
  status: string;
  dnsRecords: string[];
}

export interface AgentmailInbox {
  inboxId: string;
  username: string;
  domain: string;
}

export interface AgentMailConnector {
  listPods: (input: {
    apiKey: string;
  }) => Promise<Array<{ podId: string }>>;
  ensurePod: (input: {
    apiKey: string;
    name: string;
  }) => Promise<AgentmailPod>;
  createDomain: (input: {
    apiKey: string;
    podId: string;
    domain: string;
  }) => Promise<AgentmailDomain>;
  createInbox: (input: {
    apiKey: string;
    podId: string;
    username: string;
    domain?: string;
  }) => Promise<AgentmailInbox>;
  listThreads: (input: {
    apiKey: string;
    inboxId: string;
  }) => Promise<Array<{ id: string; subject: string; lastMessageAt: string }>>;
  getMessage: (input: {
    apiKey: string;
    inboxId: string;
    messageId: string;
  }) => Promise<{ id: string; subject: string; text: string; from: string }>;
  replyToMessage: (input: {
    apiKey: string;
    inboxId: string;
    messageId: string;
    body: string;
  }) => Promise<{ id: string }>;
}
