import { render, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { TenantSelector } from "../src/components/tenant-selector";

describe("TenantSelector", () => {
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
});
