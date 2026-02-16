import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { RiskSelector } from "../src/components/risk-selector";

interface CreateRiskMutationOptions {
  onSuccess?: (
    result: { riskId: string },
    input: { name: string },
  ) => Promise<void> | void;
}

const mocks = vi.hoisted(() => ({
  useUtils: vi.fn(),
  createUseMutation: vi.fn(),
}));

vi.mock("../src/lib/trpc", () => ({
  trpc: {
    useUtils: mocks.useUtils,
    risks: {
      create: { useMutation: mocks.createUseMutation },
    },
  },
}));

describe("RiskSelector", () => {
  let invalidateRisksList: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    invalidateRisksList = vi.fn(() => Promise.resolve());

    mocks.useUtils.mockReturnValue({
      risks: {
        list: {
          invalidate: invalidateRisksList,
        },
      },
    });

    mocks.createUseMutation.mockImplementation(
      (options?: CreateRiskMutationOptions) => ({
        isPending: false,
        error: null,
        reset: vi.fn(),
        mutate: (input: { name: string }) => {
          void options?.onSuccess?.({ riskId: "risk-3" }, input);
        },
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("defaults to first risk when none selected", async () => {
    const setActiveRiskId = vi.fn();

    render(
      <RiskSelector
        risks={[
          { id: "risk-1", name: "Risk One", role: "owner" },
          { id: "risk-2", name: "Risk Two", role: "admin" },
        ]}
        activeRiskId={null}
        setActiveRiskId={setActiveRiskId}
      />,
    );

    await waitFor(() => {
      expect(setActiveRiskId).toHaveBeenCalledWith("risk-1");
    });
  });

  test("opens create dialog from selector option and selects the new risk", async () => {
    const setActiveRiskId = vi.fn();

    render(
      <RiskSelector
        risks={[
          { id: "risk-1", name: "Risk One", role: "owner" },
          { id: "risk-2", name: "Risk Two", role: "admin" },
        ]}
        activeRiskId={"risk-1"}
        setActiveRiskId={setActiveRiskId}
      />,
    );

    fireEvent.change(screen.getByLabelText("Risk"), {
      target: { value: "__create_risk__" },
    });

    expect(screen.getByRole("dialog", { name: "Create Risk 🦞🦞🦞" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Risk name"), {
      target: { value: "New Risk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create risk" }));

    await waitFor(() => {
      expect(invalidateRisksList).toHaveBeenCalledTimes(1);
      expect(setActiveRiskId).toHaveBeenCalledWith("risk-3");
    });
  });

  test("shows create option even when no risks exist", () => {
    render(
      <RiskSelector
        risks={[]}
        activeRiskId={null}
        setActiveRiskId={vi.fn()}
      />,
    );

    expect(screen.getByRole("option", { name: "No risks yet" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Create risk..." })).toBeInTheDocument();
  });
});
