import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  SlidersHorizontal, Plus, X, Trash2, Edit2,
  Filter, RefreshCw, Heart,
} from 'lucide-react';
import toast from 'react-hot-toast';
import BaseWidget from './common/BaseWidget';
import CommonTable from '../common/CommonTable';
import { screenerAPI, watchlistAPI } from '../../config/api';

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
      { key: 'beta',       label: '베타',     group: '기본 정보', type: 'range', sliderRange: [0, 3] },
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
      { key: 'volume', label: '거래량', group: '가격 조건', type: 'range', unit: 'M', scale: 1e6, sliderRange: [0, 50] },
    ],
  },
];

const ALL_ITEMS = FILTER_CATALOG.flatMap((c) => c.items);

// 커스텀 모드에서 원클릭으로 조건을 추가/제거할 수 있는 빠른 태그
const QUICK_TAGS = [
  { label: '저PER',  filterKey: 'pe_ratio',     filterValue: { max: 15 } },
  { label: '고ROE',  filterKey: 'roe',           filterValue: { min: 15 } },
  { label: '저PBR',  filterKey: 'pb_ratio',      filterValue: { max: 2 } },
  { label: '고ROA',  filterKey: 'roa',           filterValue: { min: 10 } },
  { label: '고수익', filterKey: 'profit_margin', filterValue: { min: 20 } },
  { label: '기술주', filterKey: 'sector',         filterValue: { values: ['Technology'] } },
  { label: '대형주', filterKey: 'market_cap',    filterValue: { min: 100 } },
];

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

function FilterPickerModal({ open, sectors, activeFilters, onFilterChange, onClose, onSave, loading, resultCount }) {
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
        className="absolute left-1/2 -translate-x-1/2 top-4 z-50 flex flex-col rounded-xl shadow-2xl overflow-hidden w-[420px] max-w-[calc(100%-16px)]"
        style={{
          maxHeight: 'calc(100% - 32px)',
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
            <button onClick={() => { onSave(); onClose(); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500
                text-white text-xs font-semibold rounded-lg transition-colors">
              {loading ? '검색 중…' : resultCount != null ? `결과 보기 (${resultCount}개)` : '결과 보기'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── 사이드바 ──────────────────────────────────────────────────────────────────

function Sidebar({ presets, saved, activeId, onSelectPreset, onSelectSaved, onDeleteSaved, onNewScreen }) {
  return (
    <div className="flex flex-col w-52 flex-shrink-0 border-r border-gray-800/60 overflow-y-auto">
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
            <PresetSidebarItem key={p.preset_id} preset={p}
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

// ── PresetSidebarItem (설명 포함 카드형) ──────────────────────────────────────

function PresetSidebarItem({ preset, active, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
        active
          ? 'bg-cyan-500/10 border border-cyan-500/15'
          : 'border border-transparent hover:bg-white/5'
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-xs font-medium truncate flex-1 ${active ? 'text-white' : 'text-gray-300'}`}>
          {preset.name}
        </span>
        {preset.is_hot && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 font-semibold flex-shrink-0">
            HOT
          </span>
        )}
      </div>
      {preset.description && (
        <p className="text-[10px] text-gray-600 mt-0.5 leading-snug overflow-hidden"
           style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {preset.description}
        </p>
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
    watchlistAPI.getMyTickers().then((r) => setFavorites(r.tickers || [])).catch(() => {});
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
    try {
      const params = buildParams(activeFilters);
      const res = await screenerAPI.screen(params);
      setResults(res.results || []);
      setResultCount(res.count ?? (res.results || []).length);
    } catch {
      setResults([]); setResultCount(0);
    } finally { setLoading(false); }
  }, [activeFilters, buildParams]);

  // 빠른 태그 클릭: 해당 필터가 이미 있으면 제거, 없으면 태그 기본값으로 추가
  const handleQuickTag = useCallback((tag) => {
    const def = ALL_ITEMS.find((i) => i.key === tag.filterKey);
    if (!def) return;
    const exists = activeFilters.some((f) => f.key === tag.filterKey);
    setActiveFilters((prev) =>
      exists
        ? prev.filter((f) => f.key !== tag.filterKey)
        : [...prev, { key: tag.filterKey, def, value: tag.filterValue }]
    );
  }, [activeFilters]);

  const handleSelectPreset = useCallback(async (preset) => {
    setActiveId(preset.preset_id);
    setScreenTitle(preset.name);
    setScreenDesc(preset.description || '');
    setIsCustomMode(false);
    setCurrentSaved(null);
    setPickerOpen(false);

    // 프리셋 필터 조건을 UI 칩으로 복원
    const f = preset.filters || {};
    const restored = [];
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
      if (currentSaved?.screener_id) {
        // 기존 스크리너 필터 조건만 업데이트
        const s = await screenerAPI.update(currentSaved.screener_id, { filters: params, name: screenTitle });
        setSaved((prev) => prev.map((x) => x.screener_id === s.screener_id ? s : x));
        setCurrentSaved(s);
      } else {
        // 신규 저장
        const s = await screenerAPI.save({ name: screenTitle, filters: params });
        setSaved((prev) => [...prev, s]);
        setCurrentSaved(s);
        setActiveId(s.screener_id);
      }
    } catch {}
  }, [activeFilters, buildParams, screenTitle, currentSaved]);

  const handleDeleteSaved = useCallback(async (id) => {
    try {
      await screenerAPI.deleteSaved(id);
      setSaved((prev) => prev.filter((s) => s.screener_id !== id));
      if (activeId === id) { setActiveId(null); setScreenTitle(''); setActiveFilters([]); setResults([]); setResultCount(null); }
    } catch {}
  }, [activeId]);

  const toggleFavorite = useCallback(async (sym) => {
    const isAdding = !favorites.includes(sym);
    setFavorites((prev) => isAdding ? [...prev, sym] : prev.filter((s) => s !== sym));
    try {
      if (isAdding) {
        await watchlistAPI.quickAdd(sym);
        toast.success(`${sym}을(를) 관심종목에 추가했습니다.`);
      } else {
        await watchlistAPI.quickRemove(sym);
        toast.success(`${sym}을(를) 관심종목에서 제거했습니다.`);
      }
    } catch {
      setFavorites((prev) => isAdding ? prev.filter((s) => s !== sym) : [...prev, sym]);
      toast.error('관심종목 업데이트에 실패했습니다.');
    }
  }, [favorites]);

  // activeFilters 변경 시 500ms debounce 후 자동 검색 (커스텀 모드일 때만)
  useEffect(() => {
    if (!isCustomMode || !activeId) return;
    const timer = setTimeout(() => { handleRun(); }, 500);
    return () => clearTimeout(timer);
  }, [activeFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => [
    {
      key: '_fav',
      header: '',
      accessorFn: (row) => row.stk_cd || row.symbol || '',
      renderFn: (sym) => (
        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(sym); }}
          className={`p-1 rounded transition-colors ${
            favorites.includes(sym)
              ? 'text-red-400 hover:text-red-300'
              : 'text-gray-500 hover:text-red-400'
          }`}>
          <Heart size={16} fill={favorites.includes(sym) ? 'currentColor' : 'none'} />
        </button>
      ),
      sortable: false,
      width: 40,
      align: 'center',
    },
    {
      key: '_rank',
      header: '#',
      accessorFn: (_row, i) => i + 1,
      sortable: false,
      align: 'center',
      width: 40,
    },
    {
      key: '_name',
      header: '종목명',
      accessorFn: (row) => row.stk_nm || row.name || row.stk_cd || row.symbol || '',
      renderFn: (name, row) => {
        const sym = row.stk_cd || row.symbol || '';
        return (
          <div className="flex items-center gap-2">
            <LogoCircle symbol={sym} size={26} />
            <div className="min-w-0">
              <div className="text-[12px] font-medium truncate max-w-[130px]" style={{ color: 'var(--color-text-primary)' }}>{name}</div>
              <div className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{sym}</div>
            </div>
          </div>
        );
      },
      sortable: true,
      minWidth: 150,
    },
    {
      key: '_price',
      header: '현재가',
      accessorFn: (row) => row.close_price ?? row.price,
      renderFn: (price, row) => (
        <span className="text-[12px] font-medium tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
          {fmtPrice(price, row.curr || 'USD')}
        </span>
      ),
      align: 'right',
      sortable: true,
    },
    {
      key: '_change',
      header: '등락률',
      accessorFn: (row) => row.change_rate ?? row.change_pct,
      renderFn: (v) => {
        if (v == null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
        const pos = v >= 0;
        return (
          <span className={`text-[12px] font-semibold tabular-nums ${pos ? 'text-green-500' : 'text-red-500'}`}>
            {pos ? '+' : ''}{Number(v).toFixed(2)}%
          </span>
        );
      },
      align: 'right',
      sortable: true,
    },
    {
      key: 'sector',
      header: '업종',
      sortable: true,
      formatter: 'none',
    },
    {
      key: 'market_cap',
      header: '시총',
      renderFn: (v, row) => (
        <span className="text-[11px] tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
          {fmtMcap(v, row.curr || 'USD')}
        </span>
      ),
      align: 'right',
      sortable: true,
    },
    {
      key: 'pe_ratio',
      header: 'P/E',
      formatter: 'number',
      align: 'right',
      sortable: true,
    },
    {
      key: 'pb_ratio',
      header: 'P/B',
      formatter: 'number',
      align: 'right',
      sortable: true,
    },
    {
      key: 'roe',
      header: 'ROE',
      renderFn: (v) => v == null
        ? <span className="text-gray-600 text-[11px]">—</span>
        : <span className="text-[11px] tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{Number(v).toFixed(1)}%</span>,
      align: 'right',
      sortable: true,
    },
    {
      key: '_buy',
      header: '',
      accessorFn: () => null,
      renderFn: () => (
        <button className="px-2 py-0.5 text-[11px] font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded transition-colors whitespace-nowrap">
          구매
        </button>
      ),
      sortable: false,
      align: 'center',
      width: 56,
    },
  ], [favorites, toggleFavorite]);

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
            onSave={handleSave}
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

              {/* 빠른 조건 태그 바 (커스텀 모드에서만 표시) */}
              {isCustomMode && (
                <div className="flex-shrink-0 px-4 pt-1 pb-1 flex items-center gap-1.5 overflow-x-auto"
                     style={{ scrollbarWidth: 'none' }}>
                  <span className="text-[10px] text-gray-600 flex-shrink-0 mr-0.5">빠른조건</span>
                  {QUICK_TAGS.map((tag) => {
                    const isOn = activeFilters.some((f) => f.key === tag.filterKey);
                    return (
                      <button
                        key={tag.label}
                        onClick={() => handleQuickTag(tag)}
                        className={`flex-shrink-0 px-2.5 py-1 text-[11px] rounded-full border font-medium transition-colors ${
                          isOn
                            ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                            : 'border-gray-700/80 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                        }`}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              )}

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

                {isCustomMode && loading && (
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
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
                      <button onClick={handleRun} className="text-gray-600 hover:text-gray-400 transition-colors">
                        <RefreshCw size={11} />
                      </button>
                    </div>
                    <CommonTable
                      data={results}
                      columns={columns}
                      compact
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
