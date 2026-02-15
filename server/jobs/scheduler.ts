import { and, eq, lt } from "drizzle-orm";

import { jobQueue } from "../../drizzle/schema.js";
import { jobHandlers } from "./handlers/index.js";
import type { JobType } from "./handlers/types.js";
import { db } from "../lib/db.js";
import { createId } from "../lib/id.js";
import { safeJsonStringify } from "../lib/json-codec.js";
import { createRequestLogger } from "../lib/logger.js";

const logger = createRequestLogger("job-scheduler");
const recurringJobTypes: JobType[] = ["sync-usage", "validate-webhooks"];

async function enqueueRecurringJob(jobType: JobType, runAt: number): Promise<void> {
  const existing = await db.query.jobQueue.findFirst({
    where: and(
      eq(jobQueue.jobType, jobType),
      eq(jobQueue.status, "queued"),
      lt(jobQueue.runAt, runAt + 60_000),
    ),
  });

  if (!existing) {
    await db.insert(jobQueue).values({
      id: createId(),
      jobType,
      payloadJson: safeJsonStringify({}, "{}"),
      status: "queued",
      runAt,
    });
  }
}

async function enqueueRecurringJobs(): Promise<void> {
  const now = Date.now();

  for (const jobType of recurringJobTypes) {
    await enqueueRecurringJob(jobType, now);
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

      await jobHandlers[job.jobType]({
        db,
        logger,
      });

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
