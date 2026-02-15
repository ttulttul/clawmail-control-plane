/* @vitest-environment node */

import { describe, expect, test } from "vitest";

import { decryptSecret, encryptSecret, hashString } from "../server/lib/crypto";
import { hashPassword, verifyPassword } from "../server/lib/password";

describe("crypto utilities", () => {
  test("encryptSecret and decryptSecret roundtrip", () => {
    const plaintext = "sensitive-value";
    const encrypted = encryptSecret(plaintext);

    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  test("hashString is stable and one-way", () => {
    const value = "hello";
    const hash1 = hashString(value);
    const hash2 = hashString(value);

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(value);
    expect(hash1).toHaveLength(64);
  });

  test("password hashing and verification", () => {
    const hash = hashPassword("super-secure-password");

    expect(verifyPassword("super-secure-password", hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });
});
