import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const COLS  = 12;
const ROW_H = 60;

function storageKey(screen) {
  return `grid-layout:${screen}`;
}

function load(screen) {
  try {
    const raw = localStorage.getItem(storageKey(screen));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function save(screen, widgets) {
  try {
    localStorage.setItem(storageKey(screen), JSON.stringify(widgets));
  } catch {}
}

export default function DashboardGrid({
  screen,
  defaultWidgets = [],
  renderWidget,
  onAddWidgetReady,
  className = '',
  children,
}) {
  const [widgets, setWidgets] = useState(() => load(screen) ?? defaultWidgets);
  const [containerWidth, setContainerWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1440,
  );

  // If screen changes (tab switch), reload from storage
  useEffect(() => {
    setWidgets(load(screen) ?? defaultWidgets);
  }, [screen]);

  useEffect(() => {
    const update = () => setContainerWidth(window.innerWidth);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

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

  const saveTimerRef = useRef(null);

  const onLayoutChange = useCallback((newLayout) => {
    setWidgets(prev => {
      const next = prev.map(w => {
        const pos = newLayout.find(l => l.i === w.id);
        return pos ? { ...w, x: pos.x, y: pos.y, w: pos.w, h: pos.h } : w;
      });
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => save(screen, next), 500);
      return next;
    });
  }, [screen]);

  const removeWidget = useCallback((id) => {
    setWidgets(prev => {
      const next = prev.filter(w => w.id !== id);
      save(screen, next);
      return next;
    });
  }, [screen]);

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
    setWidgets(prev => {
      const next = [...prev, newWidget];
      save(screen, next);
      return next;
    });
  }, [screen]);

  useEffect(() => {
    onAddWidgetReady?.(addWidget);
  }, [addWidget, onAddWidgetReady]);

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  return (
    <div className={`w-full ${className}`}>
      <GridLayout
        className="layout"
        layout={layout}
        cols={COLS}
        rowHeight={ROW_H}
        width={containerWidth - 32}
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
