import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { trpc } from "../lib/trpc";
import type { RouterOutputs } from "../types/trpc";

type CastList = RouterOutputs["casts"]["list"];
const CREATE_CAST_OPTION_VALUE = "__create_cast__";

export function CastSelector(props: {
  casts: CastList | undefined;
  activeCastId: string | null;
  setActiveCastId: (castId: string | null) => void;
}) {
  const { casts, activeCastId, setActiveCastId } = props;
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [castName, setCastName] = useState("");
  const utils = trpc.useUtils();

  const createCastDisabledReason = useMemo(() => {
    if (castName.trim().length < 2) {
      return "Enter a cast name with at least 2 characters.";
    }

    return null;
  }, [castName]);

  const createCast = trpc.casts.create.useMutation({
    onSuccess: async (result) => {
      await utils.casts.list.invalidate();
      setActiveCastId(result.castId);
      setCastName("");
      setIsCreateDialogOpen(false);
    },
  });

  useEffect(() => {
    if (!casts || casts.length === 0) {
      if (activeCastId !== null) {
        setActiveCastId(null);
      }
      return;
    }

    if (!activeCastId) {
      setActiveCastId(casts[0].id);
      return;
    }

    const exists = casts.some((cast) => cast.id === activeCastId);
    if (!exists) {
      setActiveCastId(casts[0].id);
    }
  }, [casts, activeCastId, setActiveCastId]);

  const openCreateDialog = () => {
    createCast.reset();
    setCastName("");
    setIsCreateDialogOpen(true);
  };

  const closeCreateDialog = () => {
    if (createCast.isPending) {
      return;
    }

    createCast.reset();
    setCastName("");
    setIsCreateDialogOpen(false);
  };

  const handleCastChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === CREATE_CAST_OPTION_VALUE) {
      openCreateDialog();
      return;
    }

    setActiveCastId(value || null);
  };

  const handleCreateCastSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = castName.trim();
    if (name.length < 2 || createCast.isPending) {
      return;
    }

    createCast.mutate({ name });
  };

  const hasCasts = Boolean(casts && casts.length > 0);

  return (
    <>
      <label className="cast-selector">
        Cast
        <select value={activeCastId ?? ""} onChange={handleCastChange}>
          {!hasCasts && (
            <option value="">
              {casts ? "No casts yet" : "Loading casts..."}
            </option>
          )}
          {hasCasts && !activeCastId && <option value="" disabled>Select cast</option>}
          {casts?.map((cast) => (
            <option key={cast.id} value={cast.id}>
              {cast.name}
            </option>
          ))}
          <option value={CREATE_CAST_OPTION_VALUE}>Create cast...</option>
        </select>
      </label>

      {isCreateDialogOpen && (
        <div
          className="cast-create-dialog-backdrop"
          role="presentation"
          onClick={closeCreateDialog}
        >
          <div
            className="cast-create-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-cast-title"
            aria-describedby="create-cast-description"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header">
              <h2 id="create-cast-title">Create Cast 🦀🦀🦀</h2>
              <p id="create-cast-description" className="muted-copy">
                Enter a name for the new cast.
              </p>
            </div>

            <form className="form-grid" onSubmit={handleCreateCastSubmit}>
              <label>
                Cast name
                <input
                  value={castName}
                  onChange={(event) => {
                    if (createCast.error) {
                      createCast.reset();
                    }
                    setCastName(event.target.value);
                  }}
                  placeholder="acme-mail"
                  autoFocus
                />
              </label>
              {createCastDisabledReason && (
                <p className="hint-message">{createCastDisabledReason}</p>
              )}
              {createCast.error && (
                <p className="status-pill error" role="alert">
                  {createCast.error.message}
                </p>
              )}
              <div className="button-row">
                <button
                  type="submit"
                  disabled={createCast.isPending || createCastDisabledReason !== null}
                >
                  {createCast.isPending ? "Creating cast..." : "Create cast"}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={closeCreateDialog}
                  disabled={createCast.isPending}
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
