import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { CastSelector } from "../src/components/cast-selector";

interface CreateCastMutationOptions {
  onSuccess?: (
    result: { castId: string },
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
    casts: {
      create: { useMutation: mocks.createUseMutation },
    },
  },
}));

describe("CastSelector", () => {
  let invalidateCastsList: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    invalidateCastsList = vi.fn(() => Promise.resolve());

    mocks.useUtils.mockReturnValue({
      casts: {
        list: {
          invalidate: invalidateCastsList,
        },
      },
    });

    mocks.createUseMutation.mockImplementation(
      (options?: CreateCastMutationOptions) => ({
        isPending: false,
        error: null,
        reset: vi.fn(),
        mutate: (input: { name: string }) => {
          void options?.onSuccess?.({ castId: "cast-3" }, input);
        },
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("defaults to first cast when none selected", async () => {
    const setActiveCastId = vi.fn();

    render(
      <CastSelector
        casts={[
          { id: "cast-1", name: "Cast One", role: "owner" },
          { id: "cast-2", name: "Cast Two", role: "admin" },
        ]}
        activeCastId={null}
        setActiveCastId={setActiveCastId}
      />,
    );

    await waitFor(() => {
      expect(setActiveCastId).toHaveBeenCalledWith("cast-1");
    });
  });

  test("opens create dialog from selector option and selects the new cast", async () => {
    const setActiveCastId = vi.fn();

    render(
      <CastSelector
        casts={[
          { id: "cast-1", name: "Cast One", role: "owner" },
          { id: "cast-2", name: "Cast Two", role: "admin" },
        ]}
        activeCastId={"cast-1"}
        setActiveCastId={setActiveCastId}
      />,
    );

    fireEvent.change(screen.getByLabelText("Cast"), {
      target: { value: "__create_cast__" },
    });

    expect(screen.getByRole("dialog", { name: "Create Cast 🦀🦀🦀" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Cast name"), {
      target: { value: "New Cast" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create cast" }));

    await waitFor(() => {
      expect(invalidateCastsList).toHaveBeenCalledTimes(1);
      expect(setActiveCastId).toHaveBeenCalledWith("cast-3");
    });
  });

  test("shows create option even when no casts exist", () => {
    render(
      <CastSelector
        casts={[]}
        activeCastId={null}
        setActiveCastId={vi.fn()}
      />,
    );

    expect(screen.getByRole("option", { name: "No casts yet" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Create cast..." })).toBeInTheDocument();
  });
});
