/**
 * WidgetSyncContext — global symbol / period synchronisation across widgets
 *
 * Usage:
 *   1. Wrap a dashboard page with <WidgetSyncProvider>
 *   2. Pass `syncable` prop to BaseWidget (opt-in per widget)
 *   3. When user clicks the chain-link icon, that widget broadcasts its
 *      symbol/period to all other synced widgets on the same page.
 */
import { createContext, useContext, useState, useCallback } from 'react';

const WidgetSyncContext = createContext(null);

export function WidgetSyncProvider({ children, defaultSymbol = 'AAPL', defaultPeriod = '1y' }) {
  const [globalSymbol, setGlobalSymbolRaw] = useState(defaultSymbol);
  const [globalPeriod,  setGlobalPeriodRaw]  = useState(defaultPeriod);
  // Track how many widgets are currently synced (for UI feedback)
  const [syncCount, setSyncCount] = useState(0);

  const setGlobalSymbol = useCallback((sym) => {
    if (sym) setGlobalSymbolRaw(sym.toUpperCase());
  }, []);

  const setGlobalPeriod = useCallback((p) => {
    if (p) setGlobalPeriodRaw(p);
  }, []);

  const registerSync  = useCallback(() => setSyncCount(n => n + 1), []);
  const unregisterSync = useCallback(() => setSyncCount(n => Math.max(0, n - 1)), []);

  return (
    <WidgetSyncContext.Provider value={{
      globalSymbol, setGlobalSymbol,
      globalPeriod,  setGlobalPeriod,
      syncCount,
      registerSync, unregisterSync,
    }}>
      {children}
    </WidgetSyncContext.Provider>
  );
}

export const useWidgetSync = () => useContext(WidgetSyncContext);
