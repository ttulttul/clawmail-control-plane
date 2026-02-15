import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { TenantsRoute } from "../src/routes/tenants";

interface ProviderStatusData {
  mailchannelsAccountId: string | null;
  mailchannelsParentApiKey: string | null;
  agentmailApiKey: string | null;
}

interface MailchannelsMutationInput {
  tenantId: string;
  accountId?: string;
  parentApiKey?: string;
}

interface AgentmailMutationInput {
  tenantId: string;
  apiKey: string;
}

interface MutationOptions<TInput> {
  onMutate?: (input: TInput) => void;
  onSuccess?: (data: unknown, input: TInput) => Promise<void> | void;
  onError?: (error: Error, input: TInput) => void;
}

const mocks = vi.hoisted(() => ({
  useActiveTenant: vi.fn(),
  useUtils: vi.fn(),
  listUseQuery: vi.fn(),
  providerStatusUseQuery: vi.fn(),
  createUseMutation: vi.fn(),
  connectMailchannelsUseMutation: vi.fn(),
  connectAgentmailUseMutation: vi.fn(),
}));

vi.mock("../src/hooks/use-active-tenant", () => ({
  useActiveTenant: mocks.useActiveTenant,
}));

vi.mock("../src/lib/trpc", () => ({
  trpc: {
    useUtils: mocks.useUtils,
    tenants: {
      list: { useQuery: mocks.listUseQuery },
      providerStatus: { useQuery: mocks.providerStatusUseQuery },
      create: { useMutation: mocks.createUseMutation },
      connectMailchannels: { useMutation: mocks.connectMailchannelsUseMutation },
      connectAgentmail: { useMutation: mocks.connectAgentmailUseMutation },
    },
  },
}));

function createMutationMock<TInput>(
  mutate: (input: TInput) => void = () => undefined,
): {
  isPending: boolean;
  error: null;
  mutate: (input: TInput) => void;
} {
  return {
    isPending: false,
    error: null,
    mutate,
  };
}

async function advanceTimerAndFlush(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("TenantsRoute", () => {
  let providerStatusData: ProviderStatusData;
  let mailchannelsOutcome: "success" | "error";
  let agentmailOutcome: "success" | "error";
  let autoResolveMutations: boolean;
  const mailchannelsErrorMessage = "Unable to validate the MailChannels parent API key.";
  const agentmailErrorMessage = "Unable to validate the AgentMail API key.";
  const mailchannelsRejectionText = "Credential was rejected by MailChannels.";

  const mailchannelsMutate = vi.fn();
  const agentmailMutate = vi.fn();

  beforeEach(() => {
    providerStatusData = {
      mailchannelsAccountId: "mcacct...",
      mailchannelsParentApiKey: "secret...",
      agentmailApiKey: "agentm...",
    };
    mailchannelsOutcome = "success";
    agentmailOutcome = "success";
    autoResolveMutations = true;

    mailchannelsMutate.mockReset();
    agentmailMutate.mockReset();

    const invalidate = vi.fn(() => Promise.resolve());

    mocks.useActiveTenant.mockReturnValue({
      activeTenantId: "tenant-1",
      setActiveTenantId: vi.fn(),
    });

    mocks.useUtils.mockReturnValue({
      logs: { audit: { invalidate } },
      tenants: {
        list: { invalidate },
        providerStatus: { invalidate },
      },
    });

    mocks.listUseQuery.mockReturnValue({
      isLoading: false,
      error: null,
      data: [{ id: "tenant-1", name: "Tenant One", role: "owner" }],
      refetch: vi.fn(),
    });

    mocks.providerStatusUseQuery.mockImplementation(() => ({
      isLoading: false,
      error: null,
      data: providerStatusData,
    }));

    mocks.createUseMutation.mockImplementation(() =>
      createMutationMock<{ name: string }>(),
    );

    mocks.connectMailchannelsUseMutation.mockImplementation(
      (options?: MutationOptions<MailchannelsMutationInput>) =>
        createMutationMock<MailchannelsMutationInput>((input) => {
          options?.onMutate?.(input);
          mailchannelsMutate(input);

          if (!autoResolveMutations) {
            return;
          }

          setTimeout(() => {
            if (mailchannelsOutcome === "success") {
              if (typeof input.accountId === "string") {
                providerStatusData.mailchannelsAccountId = "mcacct...";
              }

              if (typeof input.parentApiKey === "string") {
                providerStatusData.mailchannelsParentApiKey = "secret...";
              }

              void options?.onSuccess?.({ success: true }, input);
              return;
            }

            options?.onError?.(new Error(mailchannelsErrorMessage), input);
          }, 100);
        }),
    );

    mocks.connectAgentmailUseMutation.mockImplementation(
      (options?: MutationOptions<AgentmailMutationInput>) =>
        createMutationMock<AgentmailMutationInput>((input) => {
          options?.onMutate?.(input);
          agentmailMutate(input);

          if (!autoResolveMutations) {
            return;
          }

          setTimeout(() => {
            if (agentmailOutcome === "success") {
              providerStatusData.agentmailApiKey = "agentm...";
              void options?.onSuccess?.({ success: true }, input);
              return;
            }

            options?.onError?.(new Error(agentmailErrorMessage), input);
          }, 100);
        }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  test("shows configured redacted previews and sends only edited MailChannels fields", () => {
    autoResolveMutations = false;

    render(<TenantsRoute />);

    const accountInput = screen.getByLabelText("Account ID");
    const saveMailchannelsButton = screen.getByRole("button", {
      name: "Save MailChannels",
    });

    expect(accountInput).toHaveValue("mcacct...");
    expect(accountInput).toHaveClass("configured");
    expect(saveMailchannelsButton).toBeDisabled();

    fireEvent.click(accountInput);

    expect(accountInput).toHaveValue("");
    expect(
      screen.getByText("Enter a new MailChannels account id."),
    ).toBeInTheDocument();

    fireEvent.change(accountInput, { target: { value: "mcacct_new" } });

    expect(saveMailchannelsButton).toBeEnabled();

    fireEvent.click(saveMailchannelsButton);

    expect(mailchannelsMutate).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      accountId: "mcacct_new",
      parentApiKey: undefined,
    });
  });

  test("greys and shimmers during validation, then shows green check and redacted preview on success", async () => {
    vi.useFakeTimers();
    providerStatusData = {
      mailchannelsAccountId: null,
      mailchannelsParentApiKey: null,
      agentmailApiKey: null,
    };

    render(<TenantsRoute />);

    const apiKeyInput = screen.getByPlaceholderText("AgentMail API key");

    fireEvent.change(apiKeyInput, {
      target: { value: "agentmail_new_key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save AgentMail" }));

    expect(apiKeyInput).toHaveClass("is-validating");
    expect(apiKeyInput).toHaveAttribute("readonly");

    await advanceTimerAndFlush(100);

    expect(screen.getByPlaceholderText("AgentMail API key")).toHaveClass("is-verified");
    expect(screen.getByText("✅")).toBeInTheDocument();

    await advanceTimerAndFlush(1400);

    expect(screen.queryByText("✅")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("AgentMail API key")).toHaveValue("agentm...");
    expect(screen.getByPlaceholderText("AgentMail API key")).toHaveClass("configured");
  });

  test("shows red X for failed validation then falls back to default editable entry", async () => {
    vi.useFakeTimers();
    mailchannelsOutcome = "error";

    render(<TenantsRoute />);

    const accountInput = screen.getByPlaceholderText("MailChannels account ID");

    fireEvent.click(accountInput);
    fireEvent.change(accountInput, { target: { value: "invalid_account" } });
    fireEvent.click(screen.getByRole("button", { name: "Save MailChannels" }));

    expect(screen.getByPlaceholderText("Enter a new MailChannels account id")).toHaveClass(
      "is-validating",
    );
    expect(screen.getByPlaceholderText("Enter a new MailChannels account id")).toHaveAttribute(
      "readonly",
    );

    await advanceTimerAndFlush(100);

    expect(screen.getByPlaceholderText("Enter a new MailChannels account id")).toHaveClass(
      "is-invalid",
    );
    expect(screen.getByText("❌")).toBeInTheDocument();
    expect(screen.getByText(`❌ ${mailchannelsRejectionText}`)).toBeInTheDocument();
    expect(screen.queryByText(mailchannelsErrorMessage)).not.toBeInTheDocument();

    await advanceTimerAndFlush(2800);
    expect(screen.getByText("❌")).toBeInTheDocument();
    expect(screen.getByText(`❌ ${mailchannelsRejectionText}`)).toBeInTheDocument();

    await advanceTimerAndFlush(1400);

    expect(screen.queryByText("❌")).not.toBeInTheDocument();
    expect(
      screen.queryByText(`❌ ${mailchannelsRejectionText}`),
    ).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter a new MailChannels account id")).toHaveValue("");
    expect(screen.getByPlaceholderText("Enter a new MailChannels account id")).toHaveAttribute(
      "placeholder",
      "Enter a new MailChannels account id",
    );
    expect(screen.getByPlaceholderText("Enter a new MailChannels account id")).not.toHaveClass(
      "configured",
    );
    expect(
      screen.getByPlaceholderText("Enter a new MailChannels account id"),
    ).not.toHaveAttribute("readonly");
  });
});
