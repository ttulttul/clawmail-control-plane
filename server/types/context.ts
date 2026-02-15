import type { Session, User } from "lucia";

import type { db } from "../lib/db.js";
import type { RequestLogger } from "../lib/logger.js";

export interface AuthContext {
  user: User;
  session: Session;
}

export interface RequestContext {
  db: typeof db;
  logger: RequestLogger;
  requestId: string;
  auth: AuthContext | null;
}
