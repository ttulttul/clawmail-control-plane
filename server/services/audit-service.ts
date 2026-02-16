import { auditLog } from "../../drizzle/schema.js";
import type { DatabaseClient } from "../lib/db.js";
import { createId } from "../lib/id.js";
import { safeJsonStringify } from "../lib/json-codec.js";

export interface AuditEntry {
  actorUserId: string | null;
  riskId: string;
  action: string;
  targetType: string;
  targetId: string;
  diff: Record<string, unknown>;
}

export async function recordAuditEvent(
  db: DatabaseClient,
  entry: AuditEntry,
): Promise<void> {
  await db.insert(auditLog).values({
    id: createId(),
    actorUserId: entry.actorUserId,
    riskId: entry.riskId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    diffJson: safeJsonStringify(entry.diff, "{}"),
  });
}
