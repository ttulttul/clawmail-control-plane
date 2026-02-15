import { env } from "../lib/env.js";

import { LiveAgentMailConnector, LiveMailChannelsConnector } from "./live.js";
import { MockAgentMailConnector, MockMailChannelsConnector } from "./mock.js";
import type { AgentMailConnector, MailChannelsConnector } from "./types.js";

export interface ProviderConnectors {
  mailchannels: MailChannelsConnector;
  agentmail: AgentMailConnector;
}

export function createProviderConnectors(): ProviderConnectors {
  if (env.CONNECTOR_MODE === "live") {
    return {
      mailchannels: new LiveMailChannelsConnector(env.MAILCHANNELS_BASE_URL),
      agentmail: new LiveAgentMailConnector(env.AGENTMAIL_BASE_URL),
    };
  }

  return {
    mailchannels: new MockMailChannelsConnector(),
    agentmail: new MockAgentMailConnector(),
  };
}
