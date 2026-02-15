import { syncSubaccountUsage } from "../../services/mailchannels-provisioning-service.js";

import type { JobHandler } from "./types.js";

export const runSyncUsageJob: JobHandler = async ({ db, logger }) => {
  const subaccounts = await db.query.mailchannelsSubaccounts.findMany();

  for (const subaccount of subaccounts) {
    try {
      await syncSubaccountUsage(db, {
        tenantId: subaccount.tenantId,
        instanceId: subaccount.instanceId,
      });
    } catch (error) {
      logger.warn("sync-usage job failed for instance", {
        instanceId: subaccount.instanceId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
};
