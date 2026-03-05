import { create } from 'zustand';

/**
 * A Zustand store to manage a global refresh trigger for widgets.
 */
const useRefreshStore = create((set) => ({
  refreshKey: 0,
  triggerRefresh: () => set((state) => ({ refreshKey: state.refreshKey + 1 })),
}));

export default useRefreshStore;
