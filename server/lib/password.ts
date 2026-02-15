import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) {
    return false;
  }

  const derived = scryptSync(password, salt, KEY_LEN);
  const stored = Buffer.from(hash, "hex");
  if (stored.length !== derived.length) {
    return false;
  }

  return timingSafeEqual(stored, derived);
}
