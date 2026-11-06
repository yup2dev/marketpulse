import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { widgetSize } from '../../registry/widgetSizes';
import { WidgetInstanceContext, clearWidgetState } from '../widgets/ui/widgetPersistence';
import 'react-resizable/css/styles.css';

const COLS   = 12;
const ROW_H  = 60;
const MARGIN = 8;

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
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // If screen changes (tab switch), reload from storage
  useEffect(() => {
    setWidgets(load(screen) ?? defaultWidgets);
  }, [screen]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w > 0) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() =>
    widgets.map(w => {
      // 최소 크기는 위젯별 등록값 — 헤더·필터 줄·본문이 깨지기 전까지만 줄어든다
      const s = widgetSize(w.type);
      return {
        i: w.id,
        x: w.x ?? 0,
        y: w.y ?? 0,
        w: Math.max(w.w ?? s.w, s.minW),
        h: Math.max(w.h ?? s.h, s.minH),
        minW: s.minW,
        minH: s.minH,
      };
    }),
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
      clearWidgetState(`${screen}:${id}`);
      return next;
    });
  }, [screen]);

  const addWidget = useCallback((widgetDef) => {
    const newWidget = {
      id:     `w_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type:   widgetDef.id,
      x:      0,
      y:      Infinity,
      // 크기는 registry/widgetSizes 단일 기준 (등록 없는 동적 위젯만 넘겨받은 크기)
      w:      widgetSize(widgetDef.id, widgetDef.defaultSize).w,
      h:      widgetSize(widgetDef.id, widgetDef.defaultSize).h,
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
    <div ref={containerRef} className={`w-full ${className}`}>
      {containerWidth > 0 && (
        <GridLayout
          className="layout"
          layout={layout}
          cols={COLS}
          rowHeight={ROW_H}
          width={containerWidth}
          margin={[MARGIN, MARGIN]}
          containerPadding={[8, 8]}
          onLayoutChange={onLayoutChange}
          draggableHandle=".drag-handle-area, .drag-handle"
          resizeHandles={['se']}
          isDraggable
          isResizable
          compactType="vertical"
          useCSSTransforms
        >
          {widgets.map(w => (
            <div key={w.id} className="h-full">
              {/* 위젯이 고른 티커·기간 등을 인스턴스별로 기억 — 탭·화면을 옮겨 다시 mount 돼도 유지 */}
              <WidgetInstanceContext.Provider value={`${screen}:${w.id}`}>
                {renderWidget
                  ? renderWidget(w, () => removeWidget(w.id), addWidget)
                  : children}
              </WidgetInstanceContext.Provider>
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  );
}
