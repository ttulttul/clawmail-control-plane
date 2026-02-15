import { randomUUID } from "node:crypto";

export function createId(): string {
  return randomUUID();
}

export function toSubaccountHandle(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized.length >= 6) {
    return normalized.slice(0, 32);
  }

  const suffix = randomUUID().replace(/-/g, "").slice(0, 6);
  return `${normalized}${suffix}`.slice(0, 32);
}
