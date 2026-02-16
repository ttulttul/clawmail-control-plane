import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { trpc } from "../lib/trpc";
import type { RouterOutputs } from "../types/trpc";

type RiskList = RouterOutputs["risks"]["list"];
const CREATE_RISK_OPTION_VALUE = "__create_risk__";

export function RiskSelector(props: {
  risks: RiskList | undefined;
  activeRiskId: string | null;
  setActiveRiskId: (riskId: string | null) => void;
}) {
  const { risks, activeRiskId, setActiveRiskId } = props;
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [riskName, setRiskName] = useState("");
  const utils = trpc.useUtils();

  const createRiskDisabledReason = useMemo(() => {
    if (riskName.trim().length < 2) {
      return "Enter a risk name with at least 2 characters.";
    }

    return null;
  }, [riskName]);

  const createRisk = trpc.risks.create.useMutation({
    onSuccess: async (result) => {
      await utils.risks.list.invalidate();
      setActiveRiskId(result.riskId);
      setRiskName("");
      setIsCreateDialogOpen(false);
    },
  });

  useEffect(() => {
    if (!risks || risks.length === 0) {
      if (activeRiskId !== null) {
        setActiveRiskId(null);
      }
      return;
    }

    if (!activeRiskId) {
      setActiveRiskId(risks[0].id);
      return;
    }

    const exists = risks.some((risk) => risk.id === activeRiskId);
    if (!exists) {
      setActiveRiskId(risks[0].id);
    }
  }, [risks, activeRiskId, setActiveRiskId]);

  const openCreateDialog = () => {
    createRisk.reset();
    setRiskName("");
    setIsCreateDialogOpen(true);
  };

  const closeCreateDialog = () => {
    if (createRisk.isPending) {
      return;
    }

    createRisk.reset();
    setRiskName("");
    setIsCreateDialogOpen(false);
  };

  const handleRiskChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === CREATE_RISK_OPTION_VALUE) {
      openCreateDialog();
      return;
    }

    setActiveRiskId(value || null);
  };

  const handleCreateRiskSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = riskName.trim();
    if (name.length < 2 || createRisk.isPending) {
      return;
    }

    createRisk.mutate({ name });
  };

  const hasRisks = Boolean(risks && risks.length > 0);

  return (
    <>
      <label className="risk-selector">
        Risk
        <select value={activeRiskId ?? ""} onChange={handleRiskChange}>
          {!hasRisks && (
            <option value="">
              {risks ? "No risks yet" : "Loading risks..."}
            </option>
          )}
          {hasRisks && !activeRiskId && <option value="" disabled>Select risk</option>}
          {risks?.map((risk) => (
            <option key={risk.id} value={risk.id}>
              {risk.name}
            </option>
          ))}
          <option value={CREATE_RISK_OPTION_VALUE}>Create risk...</option>
        </select>
      </label>

      {isCreateDialogOpen && (
        <div
          className="risk-create-dialog-backdrop"
          role="presentation"
          onClick={closeCreateDialog}
        >
          <div
            className="risk-create-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-risk-title"
            aria-describedby="create-risk-description"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header">
              <h2 id="create-risk-title">Create Risk 🦞🦞🦞</h2>
              <p id="create-risk-description" className="muted-copy">
                Enter a name for the new risk.
              </p>
            </div>

            <form className="form-grid" onSubmit={handleCreateRiskSubmit}>
              <label>
                Risk name
                <input
                  value={riskName}
                  onChange={(event) => {
                    if (createRisk.error) {
                      createRisk.reset();
                    }
                    setRiskName(event.target.value);
                  }}
                  placeholder="acme-mail"
                  autoFocus
                />
              </label>
              {createRiskDisabledReason && (
                <p className="hint-message">{createRiskDisabledReason}</p>
              )}
              {createRisk.error && (
                <p className="status-pill error" role="alert">
                  {createRisk.error.message}
                </p>
              )}
              <div className="button-row">
                <button
                  type="submit"
                  disabled={createRisk.isPending || createRiskDisabledReason !== null}
                >
                  {createRisk.isPending ? "Creating risk..." : "Create risk"}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={closeCreateDialog}
                  disabled={createRisk.isPending}
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
