/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

const KEY = "clawmail.activeCastId";

function getStoredCastId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(KEY);
}

interface ActiveCastContextValue {
  activeCastId: string | null;
  setActiveCastId: (castId: string | null) => void;
}

const ActiveCastContext = createContext<ActiveCastContextValue | null>(null);

export function ActiveCastProvider({
  children,
}: PropsWithChildren) {
  const [activeCastId, setActiveCastId] = useState<string | null>(() =>
    getStoredCastId(),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (activeCastId) {
      window.localStorage.setItem(KEY, activeCastId);
      return;
    }

    window.localStorage.removeItem(KEY);
  }, [activeCastId]);

  const value = useMemo(
    () => ({ activeCastId, setActiveCastId }),
    [activeCastId],
  );

  return (
    <ActiveCastContext.Provider value={value}>
      {children}
    </ActiveCastContext.Provider>
  );
}

export function useActiveCast(): ActiveCastContextValue {
  const context = useContext(ActiveCastContext);
  if (!context) {
    throw new Error("useActiveCast must be used within ActiveCastProvider.");
  }

  return context;
}
