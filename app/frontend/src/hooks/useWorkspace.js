/**
 * useWorkspace — convenience hook for a single screen's workspace.
 *
 * Usage:
 *   const { workspace, workspaces, saveLayout, createWorkspace, isDirty, isLoading }
 *     = useWorkspace('dashboard');
 */
import { useEffect, useCallback } from 'react';
import useWorkspaceStore from '../store/workspaceStore';

export default function useWorkspace(screen) {
  const store = useWorkspaceStore();

  // Load workspaces on mount (if not already loaded)
  useEffect(() => {
    if (!screen) return;
    if (!store.workspaces[screen]) {
      store.loadWorkspaces(screen);
    }
  }, [screen]);

  const workspace   = store.getActive(screen);
  const workspaces  = store.workspaces[screen] || [];
  const isDirty     = store.pendingChanges[screen] || false;
  const isLoading   = store.loading[screen] || false;

  const saveLayout = useCallback(
    (layout, widgets) => store.saveLayout(screen, layout, widgets),
    [screen, store.saveLayout],
  );

  const createWorkspace = useCallback(
    (name) => store.createWorkspace(screen, name),
    [screen, store.createWorkspace],
  );

  const deleteWorkspace = useCallback(
    (id) => store.deleteWorkspace(screen, id),
    [screen, store.deleteWorkspace],
  );

  const setActive = useCallback(
    (id) => store.setActive(screen, id),
    [screen, store.setActive],
  );

  const setDefault = useCallback(
    (id) => store.setDefault(screen, id),
    [screen, store.setDefault],
  );

  const markDirty = useCallback(
    () => store.markDirty(screen),
    [screen, store.markDirty],
  );

  return {
    workspace,
    workspaces,
    isDirty,
    isLoading,
    saveLayout,
    createWorkspace,
    deleteWorkspace,
    setActive,
    setDefault,
    markDirty,
  };
}
