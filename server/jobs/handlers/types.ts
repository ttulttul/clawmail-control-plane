import type { jobQueue } from "../../../drizzle/schema.js";
import type { DatabaseClient } from "../../lib/db.js";
import type { RequestLogger } from "../../lib/logger.js";

export type JobType = typeof jobQueue.$inferSelect["jobType"];

export interface JobHandlerContext {
  db: DatabaseClient;
  logger: RequestLogger;
}

export type JobHandler = (context: JobHandlerContext) => Promise<void>;
