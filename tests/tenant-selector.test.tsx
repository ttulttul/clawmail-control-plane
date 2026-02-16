import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { TenantSelector } from "../src/components/tenant-selector";

interface CreateTenantMutationOptions {
  onSuccess?: (
    result: { tenantId: string },
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
    tenants: {
      create: { useMutation: mocks.createUseMutation },
    },
  },
}));

describe("TenantSelector", () => {
  let invalidateTenantsList: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    invalidateTenantsList = vi.fn(() => Promise.resolve());

    mocks.useUtils.mockReturnValue({
      tenants: {
        list: {
          invalidate: invalidateTenantsList,
        },
      },
    });

    mocks.createUseMutation.mockImplementation(
      (options?: CreateTenantMutationOptions) => ({
        isPending: false,
        error: null,
        reset: vi.fn(),
        mutate: (input: { name: string }) => {
          void options?.onSuccess?.({ tenantId: "tenant-3" }, input);
        },
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("defaults to first tenant when none selected", async () => {
    const setActiveTenantId = vi.fn();

    render(
      <TenantSelector
        tenants={[
          { id: "tenant-1", name: "Tenant One", role: "owner" },
          { id: "tenant-2", name: "Tenant Two", role: "admin" },
        ]}
        activeTenantId={null}
        setActiveTenantId={setActiveTenantId}
      />,
    );

    await waitFor(() => {
      expect(setActiveTenantId).toHaveBeenCalledWith("tenant-1");
    });
  });

  test("opens create dialog from selector option and selects the new tenant", async () => {
    const setActiveTenantId = vi.fn();

    render(
      <TenantSelector
        tenants={[
          { id: "tenant-1", name: "Tenant One", role: "owner" },
          { id: "tenant-2", name: "Tenant Two", role: "admin" },
        ]}
        activeTenantId={"tenant-1"}
        setActiveTenantId={setActiveTenantId}
      />,
    );

    fireEvent.change(screen.getByLabelText("Tenant"), {
      target: { value: "__create_tenant__" },
    });

    expect(screen.getByRole("dialog", { name: "Create tenant" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Tenant name"), {
      target: { value: "New Tenant" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create tenant" }));

    await waitFor(() => {
      expect(invalidateTenantsList).toHaveBeenCalledTimes(1);
      expect(setActiveTenantId).toHaveBeenCalledWith("tenant-3");
    });
  });

  test("shows create option even when no tenants exist", () => {
    render(
      <TenantSelector
        tenants={[]}
        activeTenantId={null}
        setActiveTenantId={vi.fn()}
      />,
    );

    expect(screen.getByRole("option", { name: "No tenants yet" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Create tenant..." })).toBeInTheDocument();
  });
});
