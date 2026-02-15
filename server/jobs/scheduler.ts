import { and, eq, lt } from "drizzle-orm";

import { jobQueue } from "../../drizzle/schema.js";
import { db } from "../lib/db.js";
import { createId } from "../lib/id.js";
import { createRequestLogger } from "../lib/logger.js";
import {
  syncSubaccountUsage,
  validateMailchannelsWebhook,
} from "../services/mailchannels-provisioning-service.js";

const logger = createRequestLogger("job-scheduler");

async function enqueueRecurringJobs(): Promise<void> {
  const now = Date.now();

  const usageJobExists = await db.query.jobQueue.findFirst({
    where: and(
      eq(jobQueue.jobType, "sync-usage"),
      eq(jobQueue.status, "queued"),
      lt(jobQueue.runAt, now + 60_000),
    ),
  });

  if (!usageJobExists) {
    await db.insert(jobQueue).values({
      id: createId(),
      jobType: "sync-usage",
      payloadJson: JSON.stringify({}),
      status: "queued",
      runAt: now,
    });
  }

  const webhookJobExists = await db.query.jobQueue.findFirst({
    where: and(
      eq(jobQueue.jobType, "validate-webhooks"),
      eq(jobQueue.status, "queued"),
      lt(jobQueue.runAt, now + 60_000),
    ),
  });

  if (!webhookJobExists) {
    await db.insert(jobQueue).values({
      id: createId(),
      jobType: "validate-webhooks",
      payloadJson: JSON.stringify({}),
      status: "queued",
      runAt: now,
    });
  }
}

async function runSyncUsageJob(): Promise<void> {
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
}

async function runValidateWebhooksJob(): Promise<void> {
  const connections = await db.query.mailchannelsConnections.findMany();

  for (const connection of connections) {
    try {
      await validateMailchannelsWebhook(db, connection.tenantId);
    } catch (error) {
      logger.warn("validate-webhooks job failed for tenant", {
        tenantId: connection.tenantId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}

async function processQueue(): Promise<void> {
  const now = Date.now();

  const jobs = await db.query.jobQueue.findMany({
    where: and(eq(jobQueue.status, "queued"), lt(jobQueue.runAt, now)),
    limit: 5,
  });

  for (const job of jobs) {
    try {
      await db
        .update(jobQueue)
        .set({ status: "running", updatedAt: now })
        .where(eq(jobQueue.id, job.id));

      if (job.jobType === "sync-usage") {
        await runSyncUsageJob();
      } else if (job.jobType === "validate-webhooks") {
        await runValidateWebhooksJob();
      }

      await db
        .update(jobQueue)
        .set({ status: "completed", updatedAt: Date.now() })
        .where(eq(jobQueue.id, job.id));
    } catch (error) {
      const attempts = job.attempts + 1;
      const terminal = attempts >= job.maxAttempts;

      await db
        .update(jobQueue)
        .set({
          attempts,
          status: terminal ? "failed" : "queued",
          runAt: Date.now() + 60_000,
          lastError: error instanceof Error ? error.message : "unknown",
          updatedAt: Date.now(),
        })
        .where(eq(jobQueue.id, job.id));
    }
  }
}

let intervalHandle: NodeJS.Timeout | null = null;

export function startJobScheduler(): void {
  if (intervalHandle) {
    return;
  }

  intervalHandle = setInterval(() => {
    void enqueueRecurringJobs().then(processQueue).catch((error) => {
      logger.error("job scheduler loop failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    });
  }, 30_000);
}

export function stopJobScheduler(): void {
  if (!intervalHandle) {
    return;
  }

  clearInterval(intervalHandle);
  intervalHandle = null;
}
