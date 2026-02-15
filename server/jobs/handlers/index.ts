import { runSyncUsageJob } from "./sync-usage-handler.js";
import { runValidateWebhooksJob } from "./validate-webhooks-handler.js";
import type { JobHandler, JobType } from "./types.js";

export const jobHandlers: Record<JobType, JobHandler> = {
  "sync-usage": runSyncUsageJob,
  "validate-webhooks": runValidateWebhooksJob,
};
