import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { trpc } from "../lib/trpc";
import type { RouterOutputs } from "../types/trpc";

type TenantList = RouterOutputs["tenants"]["list"];
const CREATE_TENANT_OPTION_VALUE = "__create_tenant__";

export function TenantSelector(props: {
  tenants: TenantList | undefined;
  activeTenantId: string | null;
  setActiveTenantId: (tenantId: string | null) => void;
}) {
  const { tenants, activeTenantId, setActiveTenantId } = props;
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [tenantName, setTenantName] = useState("");
  const utils = trpc.useUtils();

  const createTenantDisabledReason = useMemo(() => {
    if (tenantName.trim().length < 2) {
      return "Enter a tenant name with at least 2 characters.";
    }

    return null;
  }, [tenantName]);

  const createTenant = trpc.tenants.create.useMutation({
    onSuccess: async (result) => {
      await utils.tenants.list.invalidate();
      setActiveTenantId(result.tenantId);
      setTenantName("");
      setIsCreateDialogOpen(false);
    },
  });

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

  const openCreateDialog = () => {
    createTenant.reset();
    setTenantName("");
    setIsCreateDialogOpen(true);
  };

  const closeCreateDialog = () => {
    if (createTenant.isPending) {
      return;
    }

    createTenant.reset();
    setTenantName("");
    setIsCreateDialogOpen(false);
  };

  const handleTenantChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === CREATE_TENANT_OPTION_VALUE) {
      openCreateDialog();
      return;
    }

    setActiveTenantId(value || null);
  };

  const handleCreateTenantSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = tenantName.trim();
    if (name.length < 2 || createTenant.isPending) {
      return;
    }

    createTenant.mutate({ name });
  };

  const hasTenants = Boolean(tenants && tenants.length > 0);

  return (
    <>
      <label className="tenant-selector">
        Tenant
        <select value={activeTenantId ?? ""} onChange={handleTenantChange}>
          {!hasTenants && (
            <option value="">
              {tenants ? "No tenants yet" : "Loading tenants..."}
            </option>
          )}
          {hasTenants && !activeTenantId && <option value="" disabled>Select tenant</option>}
          {tenants?.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
          <option value={CREATE_TENANT_OPTION_VALUE}>Create tenant...</option>
        </select>
      </label>

      {isCreateDialogOpen && (
        <div
          className="tenant-create-dialog-backdrop"
          role="presentation"
          onClick={closeCreateDialog}
        >
          <div
            className="tenant-create-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-tenant-title"
            aria-describedby="create-tenant-description"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header">
              <h2 id="create-tenant-title">Create tenant</h2>
              <p id="create-tenant-description" className="muted-copy">
                Enter a name for the new tenant.
              </p>
            </div>

            <form className="form-grid" onSubmit={handleCreateTenantSubmit}>
              <label>
                Tenant name
                <input
                  value={tenantName}
                  onChange={(event) => {
                    if (createTenant.error) {
                      createTenant.reset();
                    }
                    setTenantName(event.target.value);
                  }}
                  placeholder="acme-mail"
                  autoFocus
                />
              </label>
              {createTenantDisabledReason && (
                <p className="hint-message">{createTenantDisabledReason}</p>
              )}
              {createTenant.error && (
                <p className="status-pill error" role="alert">
                  {createTenant.error.message}
                </p>
              )}
              <div className="button-row">
                <button
                  type="submit"
                  disabled={createTenant.isPending || createTenantDisabledReason !== null}
                >
                  {createTenant.isPending ? "Creating tenant..." : "Create tenant"}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={closeCreateDialog}
                  disabled={createTenant.isPending}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
