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

// 이 화면에서 이미 내놓은 기본 위젯 종류 — 사용자가 닫은 기본 위젯을 다시 넣지 않으려고 따로 적어 둔다
function seenKey(screen) {
  return `grid-layout-seen:${screen}`;
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function save(screen, widgets) {
  write(storageKey(screen), widgets);
}

/**
 * 저장된 배치 + 그 뒤에 새로 생긴 기본 위젯.
 * 저장된 배치가 있으면 그대로 쓰되, 기본 배치에 새로 들어온 종류(예: 백테스트 설정 패널)는 제자리에 끼워 넣는다.
 * 한 번 내놓은 종류는 seen 에 적어 두므로, 사용자가 닫으면 다시 나오지 않는다.
 * (seen 이 없던 예전 저장분은 저장된 배치의 종류를 seen 으로 본다)
 */
// 없앤 코드 위젯 — 저장된 배치에서 조용히 뺀다 (git 이력 참고: 백테스트 설정 패널은 머리줄 StrategyPicker 로 옮겼다)
const RETIRED_TYPES = new Set(['bt-settings']);

function load(screen, defaults) {
  const stored = read(storageKey(screen));
  const saved = Array.isArray(stored) ? stored.filter((w) => !RETIRED_TYPES.has(w.type)) : stored;
  const types = defaults.map((d) => d.type);
  if (!Array.isArray(saved)) {
    if (types.length) write(seenKey(screen), types);
    return defaults;
  }
  const seen = new Set(read(seenKey(screen)) || saved.map((w) => w.type));
  const have = new Set(saved.map((w) => w.type));
  const ids = new Set(saved.map((w) => w.id));
  const added = defaults
    .filter((d) => !seen.has(d.type) && !have.has(d.type))
    .map((d) => {
      let id = `${d.type}-default`;
      while (ids.has(id)) id = `${id}-1`;
      ids.add(id);
      return { ...d, id };
    });
  write(seenKey(screen), [...new Set([...seen, ...types])]);
  if (!added.length) return saved;
  // 끼워 넣는 자리 아래(가로로 겹치는) 위젯은 그 높이만큼 내린다 — 새 위젯이 제자리(예: 맨 위)를 갖게
  let next = saved;
  for (const d of added) {
    const overlaps = (w) => (w.x ?? 0) < d.x + d.w && d.x < (w.x ?? 0) + (w.w ?? 1) && (w.y ?? 0) + (w.h ?? 1) > d.y;
    next = next.map((w) => (overlaps(w) ? { ...w, y: (w.y ?? 0) + d.h } : w));
    next = [...next, d];
  }
  save(screen, next);
  return next;
}

export default function DashboardGrid({
  screen,
  defaultWidgets = [],
  renderWidget,
  onAddWidgetReady,
  className = '',
  children,
}) {
  const [widgets, setWidgets] = useState(() => load(screen, defaultWidgets));
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // If screen changes (tab switch), reload from storage
  useEffect(() => {
    setWidgets(load(screen, defaultWidgets));
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
