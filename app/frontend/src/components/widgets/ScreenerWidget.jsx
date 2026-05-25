import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  SlidersHorizontal, Plus, X, Play, Save, Trash2, Edit2,
  Filter, RefreshCw, Heart,
} from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import { screenerAPI } from '../../config/api';

// ── 상수 ──────────────────────────────────────────────────────────────────────

const PERIODS = [
  { id: '1d',  label: '하루 전 보다' },
  { id: '1w',  label: '1주일 전 보다' },
  { id: '1mo', label: '1개월 전 보다' },
];

const FILTER_CATALOG = [
  {
    id: 'basic', label: '기본',
    items: [
      { key: 'market_cap', label: '시가총액', group: '기본 정보', type: 'range', unit: 'B$', scale: 1e9, sliderRange: [0, 3000] },
      { key: 'price',      label: '주가',     group: '기본 정보', type: 'range', unit: '$',  sliderRange: [0, 2000] },
      { key: 'sector',     label: '섹터',     group: '기본 정보', type: 'multiselect' },
    ],
  },
  {
    id: 'financial', label: '재무',
    items: [
      { key: 'pe_ratio',       label: 'P/E 비율',    group: '밸류에이션', type: 'range', sliderRange: [0, 100] },
      { key: 'pb_ratio',       label: 'P/B 비율',    group: '밸류에이션', type: 'range', sliderRange: [0, 20] },
      { key: 'roe',            label: 'ROE',          group: '수익성',     type: 'range', unit: '%', sliderRange: [-50, 100] },
      { key: 'roa',            label: 'ROA',          group: '수익성',     type: 'range', unit: '%', sliderRange: [-50, 50] },
      { key: 'profit_margin',  label: '순이익률',     group: '수익성',     type: 'range', unit: '%', sliderRange: [-50, 50] },
      { key: 'debt_to_equity', label: '부채비율 D/E', group: '안전성',     type: 'range', sliderRange: [0, 10] },
      { key: 'current_ratio',  label: '유동비율',     group: '안전성',     type: 'range', sliderRange: [0, 10] },
      { key: 'quick_ratio',    label: '당좌비율',     group: '안전성',     type: 'range', sliderRange: [0, 10] },
    ],
  },
  {
    id: 'price', label: '시세',
    items: [
      {
        key: 'change_pct', label: '주가등락률', group: '가격 조건', type: 'percent_range', sliderRange: [-100, 100],
        quickOptions: [
          { label: '5% 이상 증가',  value: { min: 5 } },
          { label: '10% 이상 증가', value: { min: 10 } },
          { label: '5% 이상 하락',  value: { max: -5 } },
        ],
        periods: PERIODS,
      },
    ],
  },
];

const ALL_ITEMS = FILTER_CATALOG.flatMap((c) => c.items);

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

const LOGO_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#14b8a6','#f97316','#6366f1'];

function logoColor(sym) {
  const n = (sym || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return LOGO_COLORS[n % LOGO_COLORS.length];
}

function fmtPrice(p, curr) {
  if (p == null) return '—';
  if (curr === 'KRW') return `${Math.round(p).toLocaleString()}원`;
  return `$${Number(p).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtMcap(v, curr) {
  if (!v) return '—';
  if (curr === 'KRW') {
    if (v >= 1e12) return `${(v / 1e12).toFixed(1)}조원`;
    if (v >= 1e8)  return `${(v / 1e8).toFixed(0)}억원`;
    return `${v.toLocaleString()}원`;
  }
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  return `$${(v / 1e6).toFixed(0)}M`;
}


function numFmt(n) {
  if (n == null) return '';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// ── LogoCircle ───────────────────────────────────────────────────────────────

function LogoCircle({ symbol, size = 28 }) {
  const bg = logoColor(symbol || '');
  const text = (symbol || '??').slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 select-none"
      style={{ width: size, height: size, backgroundColor: bg, fontSize: Math.round(size * 0.36) }}
    >
      {text}
    </div>
  );
}

// ── RangeSlider ──────────────────────────────────────────────────────────────

function RangeSlider({ min: rMin, max: rMax, valueMin, valueMax, onChange }) {
  const range = rMax - rMin || 1;
  const left  = Math.max(0, Math.min(100, ((valueMin ?? rMin) - rMin) / range * 100));
  const right = Math.max(0, Math.min(100, ((valueMax ?? rMax) - rMin) / range * 100));
  return (
    <div className="relative h-1 bg-gray-700 rounded-full mx-1 mt-3 mb-5">
      <div className="absolute h-full bg-cyan-500 rounded-full"
        style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }} />
      <input type="range" min={rMin} max={rMax} step={(rMax - rMin) / 200}
        value={valueMin ?? rMin}
        onChange={(e) => onChange('min', Number(e.target.value))}
        className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" style={{ zIndex: 2 }} />
      <input type="range" min={rMin} max={rMax} step={(rMax - rMin) / 200}
        value={valueMax ?? rMax}
        onChange={(e) => onChange('max', Number(e.target.value))}
        className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" style={{ zIndex: 3 }} />
      <div className="absolute w-3.5 h-3.5 bg-white rounded-full border-2 border-cyan-500 -top-[5px] -translate-x-1/2 pointer-events-none shadow"
        style={{ left: `${left}%` }} />
      <div className="absolute w-3.5 h-3.5 bg-white rounded-full border-2 border-cyan-500 -top-[5px] -translate-x-1/2 pointer-events-none shadow"
        style={{ left: `${right}%` }} />
      <div className="absolute top-4 w-full flex justify-between text-[10px] text-gray-500 pointer-events-none">
        <span>{rMin}</span>
        <span>{rMax}</span>
      </div>
    </div>
  );
}

// ── FilterConfigPanel (우측 패널) ─────────────────────────────────────────────

function FilterConfigPanel({ item, value, onChange, sectors }) {
  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: 'var(--color-text-muted)' }}>
        <SlidersHorizontal size={20} />
        <span className="text-xs">좌측에서 필터를 선택하세요</span>
      </div>
    );
  }

  const { key, label, type, unit, sliderRange, quickOptions, periods } = item;
  const val = value || {};

  const setMin    = (v) => onChange(key, { ...val, min: v });
  const setMax    = (v) => onChange(key, { ...val, max: v });
  const setPeriod = (p) => onChange(key, { ...val, period: p });
  const applyQuick = (qv) => onChange(key, { ...val, ...qv });

  if (type === 'toggle') {
    return (
      <div className="p-4 flex flex-col gap-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</h3>
        <button
          onClick={() => onChange(key, { enabled: !val.enabled })}
          className={`self-start flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
            val.enabled
              ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-500'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          style={!val.enabled ? { borderColor: 'var(--color-border)' } : {}}
        >
          {val.enabled ? '✓ 적용됨' : '적용하기'}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4 overflow-y-auto">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</h3>

      {/* 기간 선택 */}
      {type === 'percent_range' && periods && (
        <div>
          <div className="text-[11px] mb-2" style={{ color: 'var(--color-text-muted)' }}>기간 선택</div>
          <div className="flex gap-1.5">
            {periods.map((p) => (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                  (val.period || '1d') === p.id
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-500 font-medium'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                style={(val.period || '1d') !== p.id ? { borderColor: 'var(--color-border)' } : {}}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 퀵 옵션 */}
      {quickOptions?.length > 0 && (
        <div>
          <div className="text-[11px] mb-2" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
          <div className="flex gap-1.5 flex-wrap">
            {quickOptions.map((q) => {
              const isActive =
                (q.value.min != null && val.min === q.value.min && val.max == null) ||
                (q.value.max != null && val.max === q.value.max && val.min == null);
              return (
                <button key={q.label}
                  onClick={() => applyQuick({ ...q.value, max: q.value.min != null ? undefined : q.value.max })}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    isActive ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-500 font-medium' : 'text-gray-400 hover:text-gray-200'
                  }`}
                  style={!isActive ? { borderColor: 'var(--color-border)' } : {}}
                >
                  {q.label}
                </button>
              );
            })}
            <button
              onClick={() => onChange(key, { ...val, min: undefined, max: undefined })}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                val.min == null && val.max == null
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-500 font-medium'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              style={val.min != null || val.max != null ? { borderColor: 'var(--color-border)' } : {}}
            >
              직접설정
            </button>
          </div>
        </div>
      )}

      {/* 멀티셀렉트 */}
      {type === 'multiselect' ? (
        <div>
          <div className="text-[11px] mb-2" style={{ color: 'var(--color-text-muted)' }}>섹터 선택</div>
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
            {sectors.map((s) => {
              const active = (val.values || []).includes(s);
              return (
                <button key={s}
                  onClick={() => {
                    const arr = val.values || [];
                    onChange(key, { values: active ? arr.filter((x) => x !== s) : [...arr, s] });
                  }}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    active ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-500' : 'text-gray-400 hover:text-gray-200'
                  }`}
                  style={!active ? { borderColor: 'var(--color-border)' } : {}}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2">
            <input type="number" value={numFmt(val.min)} placeholder={`최소${unit ? ` (${unit})` : ''}`}
              onChange={(e) => setMin(e.target.value === '' ? undefined : Number(e.target.value))}
              className="flex-1 rounded-lg px-3 py-2 text-xs outline-none tabular-nums"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
            <span className="text-gray-500 text-sm flex-shrink-0">~</span>
            <input type="number" value={numFmt(val.max)} placeholder="최대"
              onChange={(e) => setMax(e.target.value === '' ? undefined : Number(e.target.value))}
              className="flex-1 rounded-lg px-3 py-2 text-xs outline-none tabular-nums"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
          {sliderRange && (
            <RangeSlider
              min={sliderRange[0]} max={sliderRange[1]}
              valueMin={val.min} valueMax={val.max}
              onChange={(bound, v) => bound === 'min' ? setMin(v) : setMax(v)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── FilterPickerModal (카드형 오버레이) ───────────────────────────────────────

function FilterPickerModal({ open, sectors, activeFilters, onFilterChange, onClose, onRun, loading, resultCount }) {
  const [tab,         setTab]         = useState('price');
  const [selectedKey, setSelectedKey] = useState(null);
  const [search,      setSearch]      = useState('');

  const cat          = FILTER_CATALOG.find((c) => c.id === tab);
  const selectedItem = ALL_ITEMS.find((i) => i.key === selectedKey);
  const selectedValue = activeFilters.find((f) => f.key === selectedKey)?.value;

  const groupedItems = useMemo(() => {
    const items = cat?.items || [];
    const filtered = search
      ? ALL_ITEMS.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()))
      : items;
    const groups = {};
    for (const item of filtered) {
      const g = item.group || '기타';
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    }
    return groups;
  }, [cat, search]);

  const isActive   = (key) => activeFilters.some((f) => f.key === key);
  const isSelected = (key) => key === selectedKey;

  const handleItemClick = (item) => {
    setSelectedKey(item.key);
    if (!isActive(item.key)) {
      onFilterChange([...activeFilters, { key: item.key, def: item, value: {} }]);
    }
  };

  const handleValueChange = (key, value) => {
    onFilterChange(activeFilters.map((f) => f.key === key ? { ...f, value } : f));
  };

  const handleRemoveChip = (key) => {
    onFilterChange(activeFilters.filter((f) => f.key !== key));
    if (selectedKey === key) setSelectedKey(null);
  };

  const chipLabel = (f) => {
    const { def, value: v } = f;
    if (!v || Object.keys(v).length === 0) return def.label;
    if (def.type === 'toggle') return def.label;
    if (def.type === 'multiselect') {
      const arr = v.values || [];
      return arr.length ? `${def.label}: ${arr.slice(0, 2).join(', ')}${arr.length > 2 ? ` +${arr.length - 2}` : ''}` : def.label;
    }
    const u = def.unit || '';
    const minStr = v.min != null ? `${v.min}${u}` : '';
    const maxStr = v.max != null ? `${v.max}${u}` : '';
    if (minStr && maxStr) return `${def.label}: ${minStr}~${maxStr}`;
    if (minStr) return `${def.label} ≥ ${minStr}`;
    if (maxStr) return `${def.label} ≤ ${maxStr}`;
    return def.label;
  };

  if (!open) return null;

  return (
    <>
      {/* 배경 딤 */}
      <div className="absolute inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* 모달 카드 — 좌우 8px 여백, 위 8px, 아래는 container 기준 max-h로 제한 */}
      <div
        className="absolute inset-x-2 top-2 z-50 flex flex-col rounded-xl shadow-2xl overflow-hidden"
        style={{
          maxHeight: 'calc(100% - 16px)',
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* 탭 헤더 */}
        <div
          className="flex items-center flex-shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}
        >
          <div className="flex">
            {FILTER_CATALOG.map((c) => (
              <button key={c.id}
                onClick={() => { setTab(c.id); setSelectedKey(null); setSearch(''); }}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  tab === c.id ? 'border-cyan-500 text-cyan-500' : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 ml-auto px-3">
            <button onClick={onClose}
              className="p-1.5 rounded-lg transition-colors text-gray-400 hover:text-gray-200"
              style={{ ':hover': { backgroundColor: 'var(--color-bg-tertiary)' } }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* 바디: 좌측 목록 + 우측 설정 */}
        <div className="flex flex-1 min-h-0" style={{ minHeight: '240px' }}>
          {/* 좌측 필터 목록 */}
          <div
            className="w-44 flex-shrink-0 overflow-y-auto"
            style={{ borderRight: '1px solid var(--color-border)' }}
          >
            {Object.entries(groupedItems).map(([groupName, items]) => (
              <div key={groupName}>
                <div
                  className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {groupName}
                </div>
                {items.map((item) => (
                  <div key={item.key}
                    onClick={() => handleItemClick(item)}
                    className="flex items-center justify-between px-3 py-2 cursor-pointer transition-colors text-xs"
                    style={{
                      backgroundColor: isSelected(item.key) ? 'var(--color-bg-tertiary)' : undefined,
                      color: isSelected(item.key)
                        ? 'var(--color-text-primary)'
                        : isActive(item.key)
                        ? 'var(--color-accent)'
                        : 'var(--color-text-secondary)',
                    }}
                  >
                    <span className="flex items-center gap-1">
                      {item.label}
                      {item.krOnly && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400">KR</span>
                      )}
                    </span>
                    {isActive(item.key) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveChip(item.key); }}
                        className="text-gray-400 hover:text-red-400 transition-colors flex-shrink-0"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* 우측 설정 패널 */}
          <div className="flex-1 min-w-0 overflow-y-auto" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
            <FilterConfigPanel
              item={selectedItem}
              value={selectedValue}
              onChange={handleValueChange}
              sectors={sectors}
            />
          </div>
        </div>

        {/* 하단 바: 활성 칩 + 버튼 */}
        <div
          className="flex-shrink-0 px-3 py-2.5 flex items-center gap-2"
          style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}
        >
          <div className="flex items-center gap-1.5 flex-1 flex-wrap min-w-0 overflow-hidden" style={{ maxHeight: '48px' }}>
            {activeFilters.length === 0 && (
              <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>추가된 필터 없음</span>
            )}
            {activeFilters.map((f) => (
              <span key={f.key}
                className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] flex-shrink-0"
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {chipLabel(f)}
                <button onClick={() => handleRemoveChip(f.key)} className="text-gray-400 hover:text-red-400 transition-colors">
                  <X size={9} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {activeFilters.length > 0 && (
              <button onClick={() => { onFilterChange([]); setSelectedKey(null); }}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-200 transition-colors px-2">
                <RefreshCw size={10} />
                초기화
              </button>
            )}
            <button onClick={onRun} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                text-white text-xs font-semibold rounded-lg transition-colors">
              {loading ? '검색 중…' : resultCount != null ? `${resultCount}개 주식보기` : '주식 검색'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── 결과 테이블 ───────────────────────────────────────────────────────────────

function MetricBadge({ value, suffix = '' }) {
  if (value == null) return <span className="text-gray-600 text-[11px]">—</span>;
  return <span className="text-[11px] tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{Number(value).toFixed(1)}{suffix}</span>;
}

function ResultsTable({ results, favorites, onToggleFavorite }) {
  const thCls = 'py-2 px-2 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap';

  return (
    <table className="w-full min-w-[720px]">
      <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--color-bg-widget)' }}>
        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
          <th className={`${thCls} w-7`} />
          <th className={`${thCls} w-7 text-center`} style={{ color: 'var(--color-text-muted)' }}>#</th>
          <th className={`${thCls} text-left`}  style={{ color: 'var(--color-text-muted)' }}>종목명</th>
          <th className={`${thCls} text-right`} style={{ color: 'var(--color-text-muted)' }}>현재가</th>
          <th className={`${thCls} text-right`} style={{ color: 'var(--color-text-muted)' }}>등락률</th>
          <th className={`${thCls} text-left`}  style={{ color: 'var(--color-text-muted)' }}>업종</th>
          <th className={`${thCls} text-right`} style={{ color: 'var(--color-text-muted)' }}>시총</th>
          <th className={`${thCls} text-right`} style={{ color: 'var(--color-text-muted)' }}>P/E</th>
          <th className={`${thCls} text-right`} style={{ color: 'var(--color-text-muted)' }}>P/B</th>
          <th className={`${thCls} text-right`} style={{ color: 'var(--color-text-muted)' }}>ROE</th>
          <th className={`${thCls} w-14`} />
        </tr>
      </thead>
      <tbody>
        {results.map((row, i) => {
          const sym    = row.stk_cd || row.symbol || '';
          const name   = row.stk_nm || row.name   || sym;
          const price  = row.close_price ?? row.price;
          const chgPct = row.change_rate  ?? row.change_pct;
          const curr   = row.curr || 'USD';
          const isFav  = favorites.includes(sym);
          const pos    = chgPct == null ? null : chgPct >= 0;

          return (
            <tr key={sym || i}
              className="group transition-colors"
              style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
            >
              {/* 즐겨찾기 */}
              <td className="py-2 px-2 text-center">
                <button onClick={() => onToggleFavorite(sym)}
                  className={`transition-colors ${isFav ? 'text-red-400' : 'text-gray-600 hover:text-gray-400'}`}>
                  <Heart size={11} fill={isFav ? 'currentColor' : 'none'} />
                </button>
              </td>

              {/* 순위 */}
              <td className="py-2 px-1 text-center text-[11px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>

              {/* 종목명 */}
              <td className="py-2 px-2">
                <div className="flex items-center gap-2">
                  <LogoCircle symbol={sym} size={26} />
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium truncate max-w-[130px]" style={{ color: 'var(--color-text-primary)' }}>{name}</div>
                    <div className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{sym}</div>
                  </div>
                </div>
              </td>

              {/* 현재가 */}
              <td className="py-2 px-2 text-right tabular-nums">
                <span className="text-[12px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{fmtPrice(price, curr)}</span>
              </td>

              {/* 등락률 */}
              <td className="py-2 px-2 text-right tabular-nums">
                {chgPct == null ? (
                  <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>—</span>
                ) : (
                  <span className={`text-[12px] font-semibold ${pos ? 'text-green-500' : 'text-red-500'}`}>
                    {pos ? '+' : ''}{Number(chgPct).toFixed(2)}%
                  </span>
                )}
              </td>

              {/* 업종 */}
              <td className="py-2 px-2 max-w-[100px]">
                <span className="text-[11px] truncate block" style={{ color: 'var(--color-text-secondary)' }}>{row.sector || '—'}</span>
              </td>

              {/* 시가총액 */}
              <td className="py-2 px-2 text-right text-[11px] tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                {fmtMcap(row.market_cap, curr)}
              </td>

              {/* P/E */}
              <td className="py-2 px-2 text-right"><MetricBadge value={row.pe_ratio} /></td>

              {/* P/B */}
              <td className="py-2 px-2 text-right"><MetricBadge value={row.pb_ratio} /></td>

              {/* ROE */}
              <td className="py-2 px-2 text-right"><MetricBadge value={row.roe} suffix="%" /></td>

              {/* 구매 버튼 */}
              <td className="py-2 px-2 text-center">
                <button className="px-2 py-0.5 text-[11px] font-semibold text-blue-400
                  bg-blue-500/10 hover:bg-blue-500/20 rounded transition-colors whitespace-nowrap">
                  구매
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── 사이드바 ──────────────────────────────────────────────────────────────────

function Sidebar({ presets, saved, activeId, onSelectPreset, onSelectSaved, onDeleteSaved, onNewScreen }) {
  return (
    <div className="flex flex-col w-48 flex-shrink-0 border-r border-gray-800/60 overflow-y-auto">
      {/* 내가 만든 */}
      <div className="px-2 pt-3 pb-2">
        <div className="px-1 mb-2 text-[10px] uppercase tracking-widest text-gray-600 font-semibold">내가 만든</div>
        <button onClick={onNewScreen}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-cyan-400
            border border-dashed border-cyan-800/50 hover:bg-cyan-500/5 hover:border-cyan-600/60 transition-colors">
          <Plus size={12} />
          직접 만들기
        </button>
        <div className="mt-1 space-y-0.5">
          {saved.map((s) => (
            <SidebarItem key={s.screener_id} label={s.name}
              active={activeId === s.screener_id}
              onClick={() => onSelectSaved(s)}
              onDelete={() => onDeleteSaved(s.screener_id)} />
          ))}
        </div>
      </div>

      <div className="mx-3 my-1 border-t border-gray-800/60" />

      {/* 프리셋 */}
      <div className="px-2 pb-3">
        <div className="px-1 mb-2 text-[10px] uppercase tracking-widest text-gray-600 font-semibold">프리셋</div>
        <div className="space-y-0.5">
          {presets.map((p) => (
            <SidebarItem key={p.preset_id} label={p.name}
              badge={p.is_hot ? 'HOT' : undefined}
              active={activeId === p.preset_id}
              onClick={() => onSelectPreset(p)} />
          ))}
          {!presets.length && <p className="text-[10px] text-gray-700 px-2 py-2">프리셋 없음</p>}
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ label, active, onClick, onDelete, badge }) {
  return (
    <div onClick={onClick}
      className={`group flex items-center gap-1 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
        active ? 'bg-cyan-500/10 border border-cyan-500/15' : 'border border-transparent hover:bg-white/5'
      }`}>
      <div className="flex-1 min-w-0">
        <span className={`text-xs font-medium truncate flex items-center gap-1.5 ${active ? 'text-white' : 'text-gray-400'}`}>
          {label}
          {badge && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 font-semibold">{badge}</span>
          )}
        </span>
      </div>
      {onDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-0.5 text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function ScreenerWidget({ onRemove }) {
  const [presets,      setPresets]      = useState([]);
  const [saved,        setSaved]        = useState([]);
  const [sectors,      setSectors]      = useState([]);
  const [results,      setResults]      = useState([]);
  const [resultCount,  setResultCount]  = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [activeId,     setActiveId]     = useState(null);
  const [screenTitle,  setScreenTitle]  = useState('');
  const [screenDesc,   setScreenDesc]   = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [currentSaved, setCurrentSaved] = useState(null);
  const [pickerOpen,   setPickerOpen]   = useState(false);
  const [favorites,    setFavorites]    = useState([]);
  const [activeFilters, setActiveFilters] = useState([]);

  const titleInputRef = useRef(null);

  useEffect(() => {
    screenerAPI.getPresets().then((r) => setPresets(r.presets || [])).catch(() => {});
    screenerAPI.getSectors().then((r) => setSectors(r.sectors || [])).catch(() => {});
    screenerAPI.getSaved().then((r) => setSaved(r || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) titleInputRef.current.focus();
  }, [editingTitle]);

  const buildParams = useCallback((filters) => {
    const p = {};
    for (const f of filters) {
      const { key, type, scale } = f.def;
      const v = f.value || {};
      if (type === 'toggle') {
        if (v.enabled) p[key] = true;
      } else if (type === 'multiselect') {
        if (v.values?.length) p[key] = v.values;
      } else {
        const s = scale || 1;
        if (v.min != null) p[`${key}_min`] = v.min * s;
        if (v.max != null) p[`${key}_max`] = v.max * s;
        if (v.period)      p[`${key}_period`] = v.period;
      }
    }
    return p;
  }, []);

  const handleRun = useCallback(async () => {
    setLoading(true);
    setPickerOpen(false);
    try {
      const params = buildParams(activeFilters);
      const res = await screenerAPI.screen(params);
      setResults(res.results || []);
      setResultCount(res.count ?? (res.results || []).length);
    } catch {
      setResults([]); setResultCount(0);
    } finally { setLoading(false); }
  }, [activeFilters, buildParams]);

  const handleSelectPreset = useCallback(async (preset) => {
    setActiveId(preset.preset_id);
    setScreenTitle(preset.name);
    setScreenDesc(preset.description || '');
    setIsCustomMode(false);
    setCurrentSaved(null);
    setActiveFilters([]);
    setPickerOpen(false);
    setLoading(true);
    try {
      const res = await screenerAPI.runPreset(preset.preset_id);
      setResults(res.results || []);
      setResultCount(res.count ?? (res.results || []).length);
    } catch { setResults([]); setResultCount(0); }
    finally { setLoading(false); }
  }, []);

  const handleSelectSaved = useCallback((s) => {
    setActiveId(s.screener_id);
    setScreenTitle(s.name);
    setScreenDesc('');
    setIsCustomMode(true);
    setCurrentSaved(s);
    const restored = [];
    const f = s.filters || {};
    for (const def of ALL_ITEMS) {
      const { key, type, scale } = def;
      if (type === 'toggle') {
        if (f[key]) restored.push({ key, def, value: { enabled: true } });
      } else if (type === 'multiselect') {
        if (f[key]?.length) restored.push({ key, def, value: { values: f[key] } });
      } else {
        const sc = scale || 1;
        const min = f[`${key}_min`];
        const max = f[`${key}_max`];
        const period = f[`${key}_period`];
        if (min != null || max != null || period) {
          restored.push({ key, def, value: {
            min: min != null ? min / sc : undefined,
            max: max != null ? max / sc : undefined,
            period,
          }});
        }
      }
    }
    setActiveFilters(restored);
    setResults([]); setResultCount(null);
  }, []);

  const handleNewScreen = useCallback(() => {
    setActiveId('__new__');
    setScreenTitle('새 스크리너');
    setScreenDesc('');
    setIsCustomMode(true);
    setCurrentSaved(null);
    setActiveFilters([]);
    setResults([]); setResultCount(null);
    setEditingTitle(true);
  }, []);

  const handleSave = useCallback(async () => {
    const params = buildParams(activeFilters);
    try {
      const s = await screenerAPI.save({ name: screenTitle, filters: params });
      setSaved((prev) => {
        const exists = prev.find((x) => x.screener_id === currentSaved?.screener_id);
        return exists ? prev.map((x) => x.screener_id === s.screener_id ? s : x) : [...prev, s];
      });
      setCurrentSaved(s);
      setActiveId(s.screener_id);
    } catch {}
  }, [activeFilters, buildParams, screenTitle, currentSaved]);

  const handleDeleteSaved = useCallback(async (id) => {
    try {
      await screenerAPI.deleteSaved(id);
      setSaved((prev) => prev.filter((s) => s.screener_id !== id));
      if (activeId === id) { setActiveId(null); setScreenTitle(''); setActiveFilters([]); setResults([]); setResultCount(null); }
    } catch {}
  }, [activeId]);

  const toggleFavorite = useCallback((sym) => {
    setFavorites((prev) => prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]);
  }, []);

  // 필터 칩 라벨 (메인 바용 — 간결하게)
  const chipLabel = (f) => {
    const { def, value: v } = f;
    if (!v || Object.keys(v).length === 0) return def.label;
    if (def.type === 'toggle') return def.label;
    if (def.type === 'multiselect') {
      const arr = v.values || [];
      return arr.length ? `${def.label}: ${arr.slice(0, 1).join(', ')}${arr.length > 1 ? ` +${arr.length - 1}` : ''}` : def.label;
    }
    const u = def.unit || '';
    const pStr = v.period ? ` (${PERIODS.find((p) => p.id === v.period)?.label.replace(' 전 보다', '')})` : '';
    const minStr = v.min != null ? `${v.min}${u}` : '';
    const maxStr = v.max != null ? `${v.max}${u}` : '';
    if (minStr && maxStr) return `${def.label}${pStr}: ${minStr}~${maxStr}`;
    if (minStr) return `${def.label}${pStr} ≥ ${minStr}`;
    if (maxStr) return `${def.label}${pStr} ≤ ${maxStr}`;
    return def.label + pStr;
  };

  return (
    <BaseWidget
      title="Stock Screener"
      icon={SlidersHorizontal}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div className="absolute inset-0 flex min-h-0 overflow-hidden">

        {/* 사이드바 */}
        <Sidebar
          presets={presets} saved={saved} activeId={activeId}
          onSelectPreset={handleSelectPreset}
          onSelectSaved={handleSelectSaved}
          onDeleteSaved={handleDeleteSaved}
          onNewScreen={handleNewScreen}
        />

        {/* 메인 */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0 relative overflow-hidden">

          {/* 필터 피커 오버레이 */}
          <FilterPickerModal
            open={pickerOpen}
            sectors={sectors}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            onClose={() => setPickerOpen(false)}
            onRun={handleRun}
            loading={loading}
            resultCount={resultCount}
          />

          {activeId ? (
            <>
              {/* 제목 + 설명 */}
              <div className="flex-shrink-0 px-5 pt-4 pb-2">
                {editingTitle ? (
                  <input ref={titleInputRef} value={screenTitle}
                    onChange={(e) => setScreenTitle(e.target.value)}
                    onBlur={() => setEditingTitle(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
                    className="text-xl font-bold text-white bg-transparent border-b border-cyan-500 outline-none w-full"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{screenTitle}</h2>
                    {isCustomMode && (
                      <button onClick={() => setEditingTitle(true)} className="text-gray-600 hover:text-gray-400 mt-0.5">
                        <Edit2 size={12} />
                      </button>
                    )}
                  </div>
                )}
                {screenDesc && <p className="text-xs text-gray-500 mt-0.5">{screenDesc}</p>}
              </div>

              {/* 필터 바 */}
              <div className="flex-shrink-0 px-4 pb-2 flex items-center gap-2 flex-wrap">
                {/* 필터 추가 버튼 */}
                <button onClick={() => setPickerOpen(true)}
                  className="flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full border text-xs font-medium
                    bg-gray-800/60 border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white
                    transition-colors flex-shrink-0">
                  <SlidersHorizontal size={11} />
                  필터추가
                </button>

                {/* 활성 필터 칩 */}
                {activeFilters.map((f) => (
                  <span key={f.key}
                    className="flex items-center gap-1 pl-2.5 pr-1.5 py-1.5 rounded-full
                      bg-gray-800/60 border border-gray-600 text-[11px] text-gray-300 flex-shrink-0 cursor-pointer
                      hover:border-gray-500 transition-colors"
                    onClick={() => setPickerOpen(true)}
                  >
                    {chipLabel(f)}
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveFilters((prev) => prev.filter((x) => x.key !== f.key)); }}
                      className="text-gray-600 hover:text-red-400 transition-colors ml-0.5"
                    >
                      <X size={9} />
                    </button>
                  </span>
                ))}

                <div className="flex-1" />

                {isCustomMode && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={handleSave} disabled={!screenTitle}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-white
                        border border-gray-700 hover:border-gray-500 rounded-full transition-colors disabled:opacity-40">
                      <Save size={11} />
                      저장
                    </button>
                    <button onClick={handleRun} disabled={loading}
                      className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold text-white
                        bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500
                        rounded-full transition-colors">
                      <Play size={11} />
                      {loading ? '검색 중…' : '주식 검색'}
                    </button>
                  </div>
                )}
              </div>

              {/* 결과 */}
              <div className="flex-1 min-h-0 overflow-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : results.length > 0 ? (
                  <>
                    {/* 결과 카운트 */}
                    <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-2 border-b border-gray-800/60 bg-[#0a0e14]">
                      <span className="text-xs text-gray-500">
                        검색된 주식 ·{' '}
                        <span className="text-white font-semibold">{resultCount ?? results.length}</span>개
                      </span>
                      <button className="text-gray-600 hover:text-gray-400 transition-colors">
                        <RefreshCw size={11} />
                      </button>
                    </div>
                    <ResultsTable
                      results={results}
                      favorites={favorites}
                      onToggleFavorite={toggleFavorite}
                    />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600">
                    <Filter size={24} className="text-gray-700" />
                    <p className="text-sm text-gray-500">
                      {isCustomMode ? '필터를 추가하고 주식을 검색하세요' : '결과가 없습니다'}
                    </p>
                    {isCustomMode && (
                      <button onClick={() => setPickerOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-full border border-dashed
                          border-gray-700 text-gray-400 text-xs hover:border-gray-500 hover:text-gray-300 transition-colors">
                        <Plus size={12} />
                        필터 추가
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600">
              <SlidersHorizontal size={28} className="text-gray-700" />
              <p className="text-sm text-gray-500">좌측에서 스크리너를 선택하거나 직접 만드세요</p>
              <button onClick={handleNewScreen}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-dashed
                  border-gray-700 text-gray-400 text-xs hover:border-gray-500 hover:text-gray-300 transition-colors">
                <Plus size={13} />
                직접 만들기
              </button>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
