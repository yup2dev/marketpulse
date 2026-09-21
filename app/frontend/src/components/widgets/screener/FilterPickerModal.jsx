import { useState, useMemo } from 'react';
import { X, RefreshCw } from 'lucide-react';
import FilterConfigPanel from './FilterConfigPanel';
import { FILTER_CATALOG, ALL_ITEMS } from './screenerCatalog';

export default function FilterPickerModal({ open, sectors, activeFilters, onFilterChange, onClose, onSave, loading, resultCount }) {
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
