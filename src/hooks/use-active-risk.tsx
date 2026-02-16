/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

const KEY = "clawmail.activeRiskId";

function getStoredRiskId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(KEY);
}

interface ActiveRiskContextValue {
  activeRiskId: string | null;
  setActiveRiskId: (riskId: string | null) => void;
}

const ActiveRiskContext = createContext<ActiveRiskContextValue | null>(null);

export function ActiveRiskProvider({
  children,
}: PropsWithChildren) {
  const [activeRiskId, setActiveRiskId] = useState<string | null>(() =>
    getStoredRiskId(),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (activeRiskId) {
      window.localStorage.setItem(KEY, activeRiskId);
      return;
    }

    window.localStorage.removeItem(KEY);
  }, [activeRiskId]);

  const value = useMemo(
    () => ({ activeRiskId, setActiveRiskId }),
    [activeRiskId],
  );

  return (
    <ActiveRiskContext.Provider value={value}>
      {children}
    </ActiveRiskContext.Provider>
  );
}

export function useActiveRisk(): ActiveRiskContextValue {
  const context = useContext(ActiveRiskContext);
  if (!context) {
    throw new Error("useActiveRisk must be used within ActiveRiskProvider.");
  }

  return context;
}
