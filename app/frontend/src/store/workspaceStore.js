/**
 * workspaceStore — Zustand store for workspace management.
 * Persists only activeId (which workspace is open per screen).
 * Full workspace data is fetched from the backend.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { workspaceAPI } from '../config/api';
import { DEFAULT_WORKSPACE_TEMPLATES } from '../registry/defaultWorkspaces';

const useWorkspaceStore = create(
  persist(
    (set, get) => ({
      // { [screen]: WorkspaceItem[] }
      workspaces: {},
      // { [screen]: workspaceId | 'default' }
      activeId: {},
      // { [screen]: boolean } — unsaved layout changes
      pendingChanges: {},
      // { [screen]: boolean } — loading flag
      loading: {},

      // ── Load workspaces for a screen ──────────────────────────────────────
      loadWorkspaces: async (screen) => {
        set(s => ({ loading: { ...s.loading, [screen]: true } }));
        try {
          const list = await workspaceAPI.list(screen);
          set(s => ({
            workspaces: { ...s.workspaces, [screen]: list },
            loading: { ...s.loading, [screen]: false },
          }));
          // If no active ID set yet, pick default or first
          const current = get().activeId[screen];
          if (!current || !list.find(w => w.id === current)) {
            const def = list.find(w => w.is_default) || list[0];
            if (def) {
              set(s => ({ activeId: { ...s.activeId, [screen]: def.id } }));
            }
          }
          return list;
        } catch {
          set(s => ({ loading: { ...s.loading, [screen]: false } }));
          return [];
        }
      },

      // ── Get the active workspace object ───────────────────────────────────
      getActive: (screen) => {
        const { workspaces, activeId } = get();
        const list = workspaces[screen] || [];
        const id = activeId[screen];
        return list.find(w => w.id === id) || list[0] || null;
      },

      // ── Switch active workspace ───────────────────────────────────────────
      setActive: (screen, id) => {
        set(s => ({
          activeId: { ...s.activeId, [screen]: id },
          pendingChanges: { ...s.pendingChanges, [screen]: false },
        }));
      },

      // ── Mark layout as dirty (unsaved) ───────────────────────────────────
      markDirty: (screen) => {
        set(s => ({ pendingChanges: { ...s.pendingChanges, [screen]: true } }));
      },

      // ── Save current layout to backend ───────────────────────────────────
      saveLayout: async (screen, layout, widgets) => {
        const id = get().activeId[screen];
        if (!id) return;
        try {
          const updated = await workspaceAPI.update(id, { layout, widgets });
          set(s => {
            const list = (s.workspaces[screen] || []).map(w =>
              w.id === id ? updated : w,
            );
            return {
              workspaces: { ...s.workspaces, [screen]: list },
              pendingChanges: { ...s.pendingChanges, [screen]: false },
            };
          });
        } catch (err) {
          console.error('Failed to save workspace:', err);
        }
      },

      // ── Create a new workspace ────────────────────────────────────────────
      createWorkspace: async (screen, name) => {
        const tmpl = DEFAULT_WORKSPACE_TEMPLATES[screen] || { widgets: [] };
        try {
          const ws = await workspaceAPI.create({
            screen,
            name,
            layout: tmpl.widgets.map(w => ({
              i: w.id, x: w.x, y: w.y, w: w.w, h: w.h,
            })),
            widgets: tmpl.widgets,
            is_default: false,
          });
          set(s => {
            const list = [...(s.workspaces[screen] || []), ws];
            return {
              workspaces: { ...s.workspaces, [screen]: list },
              activeId:   { ...s.activeId, [screen]: ws.id },
            };
          });
          return ws;
        } catch (err) {
          console.error('Failed to create workspace:', err);
          return null;
        }
      },

      // ── Delete a workspace ────────────────────────────────────────────────
      deleteWorkspace: async (screen, id) => {
        try {
          await workspaceAPI.delete(id);
          set(s => {
            const list = (s.workspaces[screen] || []).filter(w => w.id !== id);
            const activeId = { ...s.activeId };
            if (activeId[screen] === id) {
              activeId[screen] = list[0]?.id || null;
            }
            return { workspaces: { ...s.workspaces, [screen]: list }, activeId };
          });
        } catch (err) {
          console.error('Failed to delete workspace:', err);
        }
      },

      // ── Set a workspace as default ────────────────────────────────────────
      setDefault: async (screen, id) => {
        try {
          const updated = await workspaceAPI.setDefault(id);
          set(s => {
            const list = (s.workspaces[screen] || []).map(w => ({
              ...w,
              is_default: w.id === id,
            }));
            return { workspaces: { ...s.workspaces, [screen]: list } };
          });
          return updated;
        } catch (err) {
          console.error('Failed to set default workspace:', err);
        }
      },
    }),
    {
      name: 'workspace-store',
      // Only persist the active workspace IDs — data is always fetched from backend
      partialize: (state) => ({ activeId: state.activeId }),
    },
  ),
);

export default useWorkspaceStore;
