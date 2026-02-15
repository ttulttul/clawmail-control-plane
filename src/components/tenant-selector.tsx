import { useEffect } from "react";

import type { RouterOutputs } from "../types/trpc";

type TenantList = RouterOutputs["tenants"]["list"];

export function TenantSelector(props: {
  tenants: TenantList | undefined;
  activeTenantId: string | null;
  setActiveTenantId: (tenantId: string | null) => void;
}) {
  const { tenants, activeTenantId, setActiveTenantId } = props;

  useEffect(() => {
    if (!tenants || tenants.length === 0) {
      if (activeTenantId !== null) {
        setActiveTenantId(null);
      }
      return;
    }

    if (!activeTenantId) {
      setActiveTenantId(tenants[0].id);
      return;
    }

    const exists = tenants.some((tenant) => tenant.id === activeTenantId);
    if (!exists) {
      setActiveTenantId(tenants[0].id);
    }
  }, [tenants, activeTenantId, setActiveTenantId]);

  return (
    <label className="tenant-selector">
      Tenant
      <select
        value={activeTenantId ?? ""}
        onChange={(event) => setActiveTenantId(event.target.value || null)}
        disabled={!tenants || tenants.length === 0}
      >
        {!tenants || tenants.length === 0 ? (
          <option value="">No tenants yet</option>
        ) : (
          tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))
        )}
      </select>
    </label>
  );
}
