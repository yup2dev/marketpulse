/**
 * CommandPalette — Ctrl+K (또는 /) 로 여는 명령 팔레트.
 *
 * 기능:
 *  - 페이지 이동 (Dashboard, Stock, Macro, Portfolio, …)
 *  - 심볼 검색 후 /stock?symbol=XXX 로 이동
 *  - ↑↓ 키보드 내비게이션 + Enter 실행
 *  - Escape 닫기
 *  - 단축키 도움말 (? 그룹)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutDashboard, BarChart3, Globe, Briefcase, Zap, FlaskConical, Bell, ArrowRight, Hash, Keyboard } from 'lucide-react';
import { API_BASE } from '../../config/api';

// ── 정적 명령 목록 ──────────────────────────────────────────────────────────

const NAV_COMMANDS = [
  { id: 'nav-dashboard', label: 'Dashboard',          desc: '메인 대시보드',          icon: LayoutDashboard, action: (nav) => nav('/'),           group: 'navigate' },
  { id: 'nav-stock',     label: 'Stock Analysis',     desc: '주식 분석',              icon: BarChart3,       action: (nav) => nav('/stock'),      group: 'navigate' },
  { id: 'nav-macro',     label: 'Macro',              desc: '거시경제 분석',           icon: Globe,           action: (nav) => nav('/macro'),      group: 'navigate' },
  { id: 'nav-portfolio', label: 'Portfolio',          desc: '포트폴리오',             icon: Briefcase,       action: (nav) => nav('/portfolios'), group: 'navigate' },
  { id: 'nav-backtest',  label: 'Backtest',           desc: '백테스트',               icon: Zap,             action: (nav) => nav('/backtest'),   group: 'navigate' },
  { id: 'nav-quantlib',  label: 'Quant Lab',          desc: '퀀트 분석',              icon: FlaskConical,    action: (nav) => nav('/quantlib'),   group: 'navigate' },
  { id: 'nav-alerts',    label: 'Alerts',             desc: '알림 관리',              icon: Bell,            action: (nav) => nav('/alerts'),     group: 'navigate' },
];

const SHORTCUT_HELP = [
  { id: 'help-1', label: 'Ctrl+K',  desc: '커맨드 팔레트 열기',  icon: Keyboard, group: 'shortcut' },
  { id: 'help-2', label: 'Escape',  desc: '팔레트 닫기',          icon: Keyboard, group: 'shortcut' },
  { id: 'help-3', label: '↑ / ↓',  desc: '항목 이동',            icon: Keyboard, group: 'shortcut' },
  { id: 'help-4', label: 'Enter',   desc: '선택 실행',            icon: Keyboard, group: 'shortcut' },
];

const GROUP_LABEL = {
  navigate: '페이지 이동',
  symbol:   '심볼 검색',
  shortcut: '단축키',
};

// ── CommandPalette 컴포넌트 ────────────────────────────────────────────────

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(0);
  const [symbolResults, setSymbolResults] = useState([]);
  const [symbolLoading, setSymbolLoading] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // 팔레트 열릴 때 초기화
  useEffect(() => {
    if (open) {
      setQuery('');
      setSymbolResults([]);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // 심볼 검색 (디바운스 200ms)
  useEffect(() => {
    if (!query.trim()) {
      setSymbolResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSymbolLoading(true);
      try {
        const res = await fetch(`${API_BASE}/stock/search?query=${encodeURIComponent(query)}&limit=5`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
        });
        if (res.ok) {
          const data = await res.json();
          const items = (data.results || data || []).slice(0, 5).map(s => ({
            id:    `sym-${s.symbol}`,
            label: s.symbol,
            desc:  s.name || '',
            icon:  Hash,
            group: 'symbol',
            action: (nav) => nav(`/stock?symbol=${s.symbol}`),
          }));
          setSymbolResults(items);
        }
      } catch { /* 무시 */ } finally {
        setSymbolLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // 전체 결과 목록 구성
  useEffect(() => {
    const q = query.toLowerCase().trim();
    let items = [];

    if (!q) {
      items = NAV_COMMANDS;
    } else {
      const navMatches = NAV_COMMANDS.filter(c =>
        c.label.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)
      );
      items = [...symbolResults, ...navMatches];
    }

    // 단축키 도움말: 쿼리 없을 때만
    if (!q) items = [...items, ...SHORTCUT_HELP];

    setResults(items);
    setSelected(0);
  }, [query, symbolResults]);

  // 선택 아이템 스크롤
  useEffect(() => {
    const el = listRef.current?.children[selected];
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const execute = useCallback((item) => {
    item.action(navigate);
    onClose();
  }, [navigate, onClose]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape')     { onClose(); return; }
    if (e.key === 'ArrowDown')  { e.preventDefault(); setSelected(i => Math.min(i + 1, results.length - 1)); return; }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setSelected(i => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter' && results[selected]) { execute(results[selected]); return; }
  };

  if (!open) return null;

  // 그룹별로 묶어서 렌더
  let currentGroup = null;
  const rows = [];
  let flatIdx = 0;
  results.forEach((item) => {
    if (item.group !== currentGroup) {
      currentGroup = item.group;
      rows.push({ type: 'group', label: GROUP_LABEL[item.group] || item.group });
    }
    rows.push({ type: 'item', item, idx: flatIdx });
    flatIdx++;
  });

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-24"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-[#0d0d12] border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
          <Search size={16} className="text-gray-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="페이지 이동 또는 심볼 검색…"
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
          />
          {symbolLoading && (
            <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          )}
          <kbd className="text-[10px] text-gray-600 border border-gray-700 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && query && !symbolLoading && (
            <div className="px-4 py-6 text-center text-xs text-gray-500">검색 결과 없음</div>
          )}

          {rows.map((row, ri) => {
            if (row.type === 'group') {
              return (
                <div key={`g-${ri}`} className="px-4 pt-3 pb-1">
                  <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">{row.label}</span>
                </div>
              );
            }
            const { item, idx } = row;
            const isSelected = idx === selected;
            const ItemIcon = item.icon;
            return (
              <button
                key={item.id}
                onMouseEnter={() => setSelected(idx)}
                onClick={() => execute(item)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  isSelected ? 'bg-cyan-500/10 text-white' : 'text-gray-300 hover:bg-gray-800/50'
                }`}
              >
                <ItemIcon size={14} className={isSelected ? 'text-cyan-400' : 'text-gray-500'} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.desc && <span className="ml-2 text-xs text-gray-500 truncate">{item.desc}</span>}
                </div>
                {isSelected && <ArrowRight size={12} className="text-cyan-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-800 flex items-center gap-3 text-[10px] text-gray-600">
          <span><kbd className="border border-gray-700 rounded px-1">↑↓</kbd> 이동</span>
          <span><kbd className="border border-gray-700 rounded px-1">Enter</kbd> 실행</span>
          <span><kbd className="border border-gray-700 rounded px-1">Esc</kbd> 닫기</span>
        </div>
      </div>
    </div>
  );
}
