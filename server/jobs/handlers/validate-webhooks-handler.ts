import { validateMailchannelsWebhook } from "../../services/mailchannels-provisioning-service.js";

import type { JobHandler } from "./types.js";

export const runValidateWebhooksJob: JobHandler = async ({ db, logger }) => {
  const connections = await db.query.mailchannelsConnections.findMany();

  for (const connection of connections) {
    try {
      await validateMailchannelsWebhook(db, connection.castId);
    } catch (error) {
      logger.warn("validate-webhooks job failed for cast", {
        castId: connection.castId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
};
