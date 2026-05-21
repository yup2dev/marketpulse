import { useCallback, useRef } from 'react';

const HANDLE = 5;
const MIN_PCT = 15;

// ── Tree helpers (exported for DashboardPage) ─────────────────────────────────

export function makePaneNode(sectionId) {
  return {
    type: 'pane',
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sectionId,
    empty: true,
  };
}

export function splitPaneNode(tree, paneId, direction, newSectionId) {
  if (tree.type === 'pane' && tree.id === paneId) {
    return {
      type: 'split',
      direction,
      sizes: [50, 50],
      children: [tree, makePaneNode(newSectionId)],
    };
  }
  if (tree.type === 'split') {
    return {
      ...tree,
      children: tree.children.map(c =>
        splitPaneNode(c, paneId, direction, newSectionId),
      ),
    };
  }
  return tree;
}

export function removePaneNode(tree, paneId) {
  if (tree.type === 'pane') return tree;
  const [a, b] = tree.children;
  if (a.type === 'pane' && a.id === paneId) return b;
  if (b.type === 'pane' && b.id === paneId) return a;
  return {
    ...tree,
    children: tree.children.map(c => removePaneNode(c, paneId)),
  };
}

export function updatePaneSection(tree, paneId, sectionId) {
  if (tree.type === 'pane') {
    return tree.id === paneId ? { ...tree, sectionId } : tree;
  }
  return {
    ...tree,
    children: tree.children.map(c => updatePaneSection(c, paneId, sectionId)),
  };
}

export function countPanes(tree) {
  if (tree.type === 'pane') return 1;
  return tree.children.reduce((s, c) => s + countPanes(c), 0);
}

export function findPane(tree, paneId) {
  if (tree.type === 'pane') return tree.id === paneId ? tree : null;
  for (const c of tree.children) {
    const r = findPane(c, paneId);
    if (r) return r;
  }
  return null;
}

// ── Resize handle ─────────────────────────────────────────────────────────────

function ResizeHandle({ direction, onResize }) {
  const isH = direction === 'horizontal';
  const ref = useRef(null);

  const onMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      const parent = ref.current?.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const total = isH ? rect.width : rect.height;
      const origin = isH ? rect.left : rect.top;

      const onMove = (ev) => {
        const pos = isH ? ev.clientX : ev.clientY;
        const pct = Math.max(
          MIN_PCT,
          Math.min(100 - MIN_PCT, ((pos - origin) / total) * 100),
        );
        onResize(pct);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = isH ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [isH, onResize],
  );

  return (
    <div
      ref={ref}
      onMouseDown={onMouseDown}
      className={`flex-shrink-0 bg-gray-800/60 hover:bg-cyan-500/50 transition-colors ${
        isH ? 'cursor-col-resize' : 'cursor-row-resize'
      }`}
      style={{ [isH ? 'width' : 'height']: HANDLE }}
    />
  );
}

// ── Recursive layout ──────────────────────────────────────────────────────────

export default function SplitPaneLayout({ tree, renderPane, onTreeChange }) {
  if (tree.type === 'pane') {
    return <div className="h-full w-full overflow-hidden">{renderPane(tree)}</div>;
  }

  const { direction, sizes, children } = tree;
  const isH = direction === 'horizontal';
  const half = HANDLE / 2;

  const handleResize = useCallback(
    (pct) => onTreeChange({ ...tree, sizes: [pct, 100 - pct] }),
    [tree, onTreeChange],
  );

  const handleChildChange = useCallback(
    (idx, child) => {
      const next = [...children];
      next[idx] = child;
      onTreeChange({ ...tree, children: next });
    },
    [tree, children, onTreeChange],
  );

  return (
    <div className={`flex ${isH ? 'flex-row' : 'flex-col'} h-full w-full`}>
      <div
        className="overflow-hidden"
        style={{
          [isH ? 'width' : 'height']: `calc(${sizes[0]}% - ${half}px)`,
        }}
      >
        <SplitPaneLayout
          tree={children[0]}
          renderPane={renderPane}
          onTreeChange={(c) => handleChildChange(0, c)}
        />
      </div>
      <ResizeHandle direction={direction} onResize={handleResize} />
      <div
        className="overflow-hidden"
        style={{
          [isH ? 'width' : 'height']: `calc(${sizes[1]}% - ${half}px)`,
        }}
      >
        <SplitPaneLayout
          tree={children[1]}
          renderPane={renderPane}
          onTreeChange={(c) => handleChildChange(1, c)}
        />
      </div>
    </div>
  );
}