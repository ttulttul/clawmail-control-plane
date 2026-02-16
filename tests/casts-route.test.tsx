import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { CastsRoute } from "../src/routes/casts";

interface ProviderStatusData {
  mailchannelsAccountId: string | null;
  mailchannelsParentApiKey: string | null;
  agentmailApiKey: string | null;
}

interface MailchannelsMutationInput {
  castId: string;
  accountId?: string;
  parentApiKey?: string;
}

interface AgentmailMutationInput {
  castId: string;
  apiKey: string;
}

interface MutationOptions<TInput> {
  onMutate?: (input: TInput) => void;
  onSuccess?: (data: unknown, input: TInput) => Promise<void> | void;
  onError?: (error: Error, input: TInput) => void;
}

const mocks = vi.hoisted(() => ({
  useActiveCast: vi.fn(),
  useUtils: vi.fn(),
  listUseQuery: vi.fn(),
  providerStatusUseQuery: vi.fn(),
  createUseMutation: vi.fn(),
  connectMailchannelsUseMutation: vi.fn(),
  connectAgentmailUseMutation: vi.fn(),
}));

vi.mock("../src/hooks/use-active-cast", () => ({
  useActiveCast: mocks.useActiveCast,
}));

vi.mock("../src/lib/trpc", () => ({
  trpc: {
    useUtils: mocks.useUtils,
    casts: {
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

describe("CastsRoute", () => {
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

    mocks.useActiveCast.mockReturnValue({
      activeCastId: "cast-1",
      setActiveCastId: vi.fn(),
    });

    mocks.useUtils.mockReturnValue({
      logs: { audit: { invalidate } },
      casts: {
        list: { invalidate },
        providerStatus: { invalidate },
      },
    });

    mocks.listUseQuery.mockReturnValue({
      isLoading: false,
      error: null,
      data: [{ id: "cast-1", name: "Cast One", role: "owner" }],
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

    render(<CastsRoute />);

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
      castId: "cast-1",
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

    render(<CastsRoute />);

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

    render(<CastsRoute />);

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
    expect(
      screen.getByDisplayValue(`❌ ${mailchannelsRejectionText}`),
    ).toBeInTheDocument();
    expect(screen.queryByText(mailchannelsErrorMessage)).not.toBeInTheDocument();

    await advanceTimerAndFlush(2800);
    expect(
      screen.getByDisplayValue(`❌ ${mailchannelsRejectionText}`),
    ).toBeInTheDocument();

    await advanceTimerAndFlush(1400);

    expect(
      screen.queryByDisplayValue(`❌ ${mailchannelsRejectionText}`),
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

  test("shows selected cast summary and hides cast creation form when casts exist", () => {
    render(<CastsRoute />);

    expect(screen.getByText("Cast One")).toBeInTheDocument();
    expect(screen.getByText("owner")).toBeInTheDocument();
    expect(screen.queryByLabelText("New cast name")).not.toBeInTheDocument();
  });

  test("shows first-cast creation form when no casts exist", () => {
    mocks.useActiveCast.mockReturnValue({
      activeCastId: null,
      setActiveCastId: vi.fn(),
    });
    mocks.listUseQuery.mockReturnValue({
      isLoading: false,
      error: null,
      data: [],
      refetch: vi.fn(),
    });

    render(<CastsRoute />);

    expect(
      screen.getByText("No casts yet. Create your first cast to begin managing providers."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("New cast name")).toBeInTheDocument();
  });
});
