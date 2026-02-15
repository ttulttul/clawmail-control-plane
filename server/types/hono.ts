import type { Session, User } from "lucia";

import type { RequestLogger } from "../lib/logger.js";

export interface AuthVariables {
  user: User;
  session: Session;
}

export interface AgentAuthVariables {
  instanceId: string;
  tenantId: string;
  scopes: string[];
}

export interface AppVariables {
  requestId: string;
  logger: RequestLogger;
  auth: AuthVariables | null;
  agentAuth: AgentAuthVariables | null;
}
