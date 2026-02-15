import { auditLog } from "../../drizzle/schema.js";
import type { DatabaseClient } from "../lib/db.js";
import { createId } from "../lib/id.js";

export interface AuditEntry {
  actorUserId: string | null;
  tenantId: string;
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
    tenantId: entry.tenantId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    diffJson: JSON.stringify(entry.diff),
  });
}
