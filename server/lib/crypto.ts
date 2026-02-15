import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { env } from "./env.js";

const ALGORITHM = "aes-256-gcm";
const KEY_VERSION = "v1";

function resolveMasterKey(): Buffer {
  if (env.APP_ENCRYPTION_KEY) {
    const fromEnv = Buffer.from(env.APP_ENCRYPTION_KEY, "base64");
    if (fromEnv.length === 32) {
      return fromEnv;
    }

    return createHash("sha256").update(env.APP_ENCRYPTION_KEY).digest();
  }

  // Development fallback. Production should always provide APP_ENCRYPTION_KEY.
  return createHash("sha256").update("clawmail-dev-encryption-key").digest();
}

const masterKey = resolveMasterKey();

export interface EncryptedSecret {
  keyVersion: string;
  nonce: string;
  ciphertext: string;
  authTag: string;
}

export function encryptSecret(plaintext: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, masterKey, nonce);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const payload: EncryptedSecret = {
    keyVersion: KEY_VERSION,
    nonce: nonce.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };

  return JSON.stringify(payload);
}

export function decryptSecret(payloadRaw: string): string {
  const payload = JSON.parse(payloadRaw) as EncryptedSecret;
  const nonce = Buffer.from(payload.nonce, "base64");
  const ciphertext = Buffer.from(payload.ciphertext, "base64");
  const authTag = Buffer.from(payload.authTag, "base64");

  const decipher = createDecipheriv(ALGORITHM, masterKey, nonce);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

export function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
