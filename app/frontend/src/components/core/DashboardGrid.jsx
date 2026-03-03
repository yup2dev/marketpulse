/**
 * DashboardGrid — workspace-aware react-grid-layout wrapper.
 *
 * Usage:
 *   <DashboardGrid
 *     screen="dashboard"
 *     defaultWidgets={DEFAULT_WORKSPACE_TEMPLATES.dashboard.widgets}
 *     renderWidget={(widgetConfig, onRemove) => <MyWidget ... />}
 *   />
 *
 * The grid:
 *  - Loads workspaces from backend on mount (via useWorkspace).
 *  - Falls back to defaultWidgets (from registry template) if no saved layout.
 *  - Marks the store dirty when layout changes.
 *  - Exposes an addWidget helper via context / ref.
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import GridLayout from 'react-grid-layout';
import useWorkspace from '../../hooks/useWorkspace';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const COLS  = 12;
const ROW_H = 60;  // px per grid row

export default function DashboardGrid({
  screen,
  defaultWidgets = [],
  renderWidget,
  className = '',
  children,
}) {
  const { workspace, isDirty, markDirty, saveLayout, isLoading } = useWorkspace(screen);

  // Active widget list: from saved workspace or template defaults
  const [widgets, setWidgets] = useState(defaultWidgets);
  const [containerWidth, setContainerWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1440,
  );

  // Sync widgets when workspace loads from backend
  useEffect(() => {
    if (workspace?.widgets?.length) {
      setWidgets(workspace.widgets);
    } else if (defaultWidgets.length) {
      setWidgets(defaultWidgets);
    }
  }, [workspace?.id]);

  // Track container width for responsive layout
  useEffect(() => {
    const update = () => setContainerWidth(window.innerWidth);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Build react-grid-layout layout array
  const layout = useMemo(() =>
    widgets.map(w => ({
      i: w.id,
      x: w.x ?? 0,
      y: w.y ?? 0,
      w: w.w ?? 4,
      h: w.h ?? 4,
      minW: 2,
      minH: 2,
    })),
  [widgets]);

  const onLayoutChange = useCallback((newLayout) => {
    // Update widget positions
    setWidgets(prev =>
      prev.map(w => {
        const pos = newLayout.find(l => l.i === w.id);
        return pos ? { ...w, x: pos.x, y: pos.y, w: pos.w, h: pos.h } : w;
      }),
    );
    markDirty();
  }, [markDirty]);

  const removeWidget = useCallback((id) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
    markDirty();
  }, [markDirty]);

  const addWidget = useCallback((widgetDef) => {
    const newWidget = {
      id:     `w_${Date.now()}`,
      type:   widgetDef.id,
      x:      0,
      y:      Infinity,
      w:      widgetDef.defaultSize?.w ?? 4,
      h:      widgetDef.defaultSize?.h ?? 4,
      config: { ...widgetDef.defaultConfig },
    };
    setWidgets(prev => [...prev, newWidget]);
    markDirty();
  }, [markDirty]);

  // Auto-save when dirty on unmount
  useEffect(() => {
    return () => {
      if (isDirty) {
        saveLayout(layout, widgets);
      }
    };
  }, [isDirty]);

  if (isLoading && !widgets.length) {
    return (
      <div className="p-6 grid grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-48 bg-gray-800/30 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <GridLayout
        className="layout"
        layout={layout}
        cols={COLS}
        rowHeight={ROW_H}
        width={containerWidth - 32}  // subtract padding
        margin={[8, 8]}
        containerPadding={[16, 16]}
        onLayoutChange={onLayoutChange}
        draggableHandle=".drag-handle-area, .drag-handle"
        resizeHandles={['se']}
        isDraggable
        isResizable
        compactType="vertical"
        useCSSTransforms
      >
        {widgets.map(w => (
          <div key={w.id}>
            {renderWidget
              ? renderWidget(w, () => removeWidget(w.id), addWidget)
              : children}
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
