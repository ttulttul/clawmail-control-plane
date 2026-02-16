/* @vitest-environment node */

import { describe, expect, test, vi } from "vitest";

import { ProviderHttpError } from "../server/connectors/provider-error";
import {
  shouldUseLiveCredentialValidation,
  validateAgentmailConnectionCredentials,
  validateMailchannelsConnectionCredentials,
} from "../server/services/provider-connections-service";

describe("provider connection credential validation", () => {
  test("uses live provider validation outside test environments", () => {
    expect(shouldUseLiveCredentialValidation("development")).toBe(true);
    expect(shouldUseLiveCredentialValidation("production")).toBe(true);
    expect(shouldUseLiveCredentialValidation("test")).toBe(false);
  });

  test("validates MailChannels credentials before saving a connection", async () => {
    const validateCredentials = vi.fn().mockResolvedValue(undefined);

    await validateMailchannelsConnectionCredentials(
      { parentApiKey: "mailchannels_test_key" },
      { validateCredentials },
    );

    expect(validateCredentials).toHaveBeenCalledWith({
      parentApiKey: "mailchannels_test_key",
    });
  });

  test("validates AgentMail credentials before saving a connection", async () => {
    const validateCredentials = vi.fn().mockResolvedValue(undefined);

    await validateAgentmailConnectionCredentials(
      { apiKey: "agentmail_test_key" },
      { validateCredentials },
    );

    expect(validateCredentials).toHaveBeenCalledWith({
      apiKey: "agentmail_test_key",
    });
  });

  test("maps MailChannels credential validation failures to TRPC errors", async () => {
    const validateCredentials = vi.fn().mockRejectedValue(
      new ProviderHttpError({
        provider: "mailchannels",
        status: 401,
        path: "/sub-account",
        body: "invalid token",
      }),
    );

    await expect(
      validateMailchannelsConnectionCredentials(
        { parentApiKey: "invalid" },
        { validateCredentials },
      ),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("maps AgentMail credential validation failures to TRPC errors", async () => {
    const validateCredentials = vi.fn().mockRejectedValue(
      new ProviderHttpError({
        provider: "agentmail",
        status: 403,
        path: "/pods",
        body: "forbidden",
      }),
    );

    await expect(
      validateAgentmailConnectionCredentials(
        { apiKey: "invalid" },
        { validateCredentials },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
