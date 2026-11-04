/**
 * navigationStore — persists last-used tab and symbol per route.
 * Restored automatically on next visit.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useNavigationStore = create(
  persist(
    (set) => ({
      // { [pathname]: sectionId }  e.g. { '/stock': 'financials' }
      lastSection: {},
      // last symbol used on stock screen
      lastSymbol: 'AAPL',

      setLastSection: (pathname, sectionId) =>
        set((s) => ({ lastSection: { ...s.lastSection, [pathname]: sectionId } })),

      setLastSymbol: (symbol) => set({ lastSymbol: symbol }),
    }),
    {
      name: 'navigation-store',
    },
  ),
);

export default useNavigationStore;
