import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { TenantsRoute } from "../src/routes/tenants";

interface ProviderStatusData {
  mailchannelsAccountId: string | null;
  mailchannelsParentApiKey: string | null;
  agentmailApiKey: string | null;
}

interface MutationOptions<TInput> {
  onMutate?: () => void;
  onSuccess?: (data: unknown, input: TInput) => Promise<void> | void;
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

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("TenantsRoute", () => {
  let providerStatusData: ProviderStatusData;
  const mailchannelsMutate = vi.fn();
  const agentmailMutate = vi.fn();

  beforeEach(() => {
    providerStatusData = {
      mailchannelsAccountId: "mcacct...",
      mailchannelsParentApiKey: "secret...",
      agentmailApiKey: "agentm...",
    };

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
      (
        options?: MutationOptions<{
          tenantId: string;
          accountId?: string;
          parentApiKey?: string;
        }>,
      ) =>
        createMutationMock<{
          tenantId: string;
          accountId?: string;
          parentApiKey?: string;
        }>((input) => {
          options?.onMutate?.();
          mailchannelsMutate(input);
        }),
    );

    mocks.connectAgentmailUseMutation.mockImplementation(
      (options?: MutationOptions<{ tenantId: string; apiKey: string }>) =>
        createMutationMock<{ tenantId: string; apiKey: string }>((input) => {
          options?.onMutate?.();
          agentmailMutate(input);
          void options?.onSuccess?.({ success: true }, input);
        }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  test("shows configured redacted credential previews and allows replacing a single MailChannels field", () => {
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

  test("fades and removes provider success notices after a short delay", async () => {
    vi.useFakeTimers();
    providerStatusData = {
      mailchannelsAccountId: null,
      mailchannelsParentApiKey: null,
      agentmailApiKey: null,
    };

    render(<TenantsRoute />);

    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "agentmail_new_key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save AgentMail" }));

    await act(async () => {
      await flushMicrotasks();
    });
    expect(screen.getByText("AgentMail API key saved.")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2600);
    });

    expect(screen.getByText("AgentMail API key saved.")).toHaveClass("is-fading");

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.queryByText("AgentMail API key saved.")).not.toBeInTheDocument();
  });
});
