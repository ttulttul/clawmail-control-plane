import { randomBytes, timingSafeEqual } from "node:crypto";

import { hashString } from "./crypto.js";

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return hashString(token);
}

export function safeTokenCompare(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
