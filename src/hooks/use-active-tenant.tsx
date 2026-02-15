/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

const KEY = "clawmail.activeTenantId";

function getStoredTenantId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(KEY);
}

interface ActiveTenantContextValue {
  activeTenantId: string | null;
  setActiveTenantId: (tenantId: string | null) => void;
}

const ActiveTenantContext = createContext<ActiveTenantContextValue | null>(null);

export function ActiveTenantProvider({
  children,
}: PropsWithChildren) {
  const [activeTenantId, setActiveTenantId] = useState<string | null>(() =>
    getStoredTenantId(),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (activeTenantId) {
      window.localStorage.setItem(KEY, activeTenantId);
      return;
    }

    window.localStorage.removeItem(KEY);
  }, [activeTenantId]);

  const value = useMemo(
    () => ({ activeTenantId, setActiveTenantId }),
    [activeTenantId],
  );

  return (
    <ActiveTenantContext.Provider value={value}>
      {children}
    </ActiveTenantContext.Provider>
  );
}

export function useActiveTenant(): ActiveTenantContextValue {
  const context = useContext(ActiveTenantContext);
  if (!context) {
    throw new Error("useActiveTenant must be used within ActiveTenantProvider.");
  }

  return context;
}
