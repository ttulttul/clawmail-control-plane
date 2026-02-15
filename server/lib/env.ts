import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().default("./data/clawmail.db"),
  APP_ENCRYPTION_KEY: z.string().optional(),
  CONNECTOR_MODE: z.enum(["mock", "live"]).default("mock"),
  MAILCHANNELS_BASE_URL: z
    .string()
    .url()
    .default("https://api.mailchannels.net/tx/v1"),
  AGENTMAIL_BASE_URL: z.string().url().default("https://api.agentmail.to/v0"),
  MAILCHANNELS_WEBHOOK_VERIFY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  WEBHOOK_SHARED_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
