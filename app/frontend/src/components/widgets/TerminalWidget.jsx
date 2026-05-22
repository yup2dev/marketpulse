import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import { apiClient, API_BASE } from '../../config/api';

const COMMANDS = {
  quote:    { desc: 'Get stock quote',             usage: 'quote AAPL',              path: (a) => `/stock/quote/${a[0]}` },
  metrics:  { desc: 'Get stock metrics',            usage: 'metrics AAPL',             path: (a) => `/stock/metrics/${a[0]}` },
  info:     { desc: 'Get company info',             usage: 'info AAPL',                path: (a) => `/stock/info/${a[0]}` },
  history:  { desc: 'Get price history',            usage: 'history AAPL [period]',    path: (a) => `/stock/history/${a[0]}?period=${a[1] || '1mo'}` },
  search:   { desc: 'Search stocks',               usage: 'search apple',             path: (a) => `/stock/search?query=${a.join(' ')}` },
  earnings: { desc: 'Get earnings data',            usage: 'earnings AAPL',            path: (a) => `/stock/earnings/${a[0]}` },
  analyst:  { desc: 'Get analyst ratings',          usage: 'analyst AAPL',             path: (a) => `/stock/analyst/${a[0]}` },
  insider:  { desc: 'Get insider trading',          usage: 'insider AAPL',             path: (a) => `/stock/insider-trading/${a[0]}` },
  holders:  { desc: 'Get stock holders',            usage: 'holders AAPL',             path: (a) => `/stock/holders/${a[0]}` },
  dividend: { desc: 'Get dividend history',         usage: 'dividend AAPL',            path: (a) => `/stock/dividends/${a[0]}` },
  splits:   { desc: 'Get stock splits',             usage: 'splits AAPL',              path: (a) => `/stock/splits/${a[0]}` },
  filings:  { desc: 'Get SEC filings',              usage: 'filings AAPL',             path: (a) => `/stock/filings/${a[0]}` },
  moat:     { desc: 'Get economic moat',            usage: 'moat AAPL',                path: (a) => `/stock/moat/${a[0]}` },
  swot:     { desc: 'Get SWOT analysis',            usage: 'swot AAPL',                path: (a) => `/stock/swot/${a[0]}` },
  score:    { desc: 'Get investment scorecard',     usage: 'score AAPL',               path: (a) => `/stock/scorecard/${a[0]}` },
  sentiment:{ desc: 'Get news sentiment',           usage: 'sentiment AAPL',           path: (a) => `/stock/sentiment/${a[0]}` },
  compare:  { desc: 'Compare stocks',              usage: 'compare AAPL,MSFT',        path: (a) => `/stock/compare?symbols=${a[0]}` },
  sector:   { desc: 'Sector performance',           usage: 'sector',                   path: () => '/stock/sector-performance' },
  corr:     { desc: 'Correlation matrix',           usage: 'corr AAPL,MSFT,GOOGL',    path: (a) => `/quantitative/correlation?symbols=${a[0]}` },
  macro:    { desc: 'Macro overview',               usage: 'macro',                    path: () => '/macro/categories' },
  yield:    { desc: 'Yield curve',                  usage: 'yield',                    path: () => '/macro/yield-curve' },
  calendar: { desc: 'Economic calendar',            usage: 'calendar',                 path: () => '/macro/economic-calendar' },
  news:     { desc: 'Latest news',                  usage: 'news [AAPL]',              path: (a) => `/news${a[0] ? `?symbol=${a[0]}` : ''}` },
};

export default function TerminalWidget({ onRemove }) {
  const [history, setHistory] = useState([
    { type: 'system', text: 'MarketPulse Terminal v1.0 — Type "help" for commands' },
  ]);
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const addOutput = useCallback((entries) => {
    setHistory((prev) => [...prev, ...entries]);
  }, []);

  const execute = async (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    setCmdHistory((prev) => [trimmed, ...prev.slice(0, 50)]);
    setHistIdx(-1);
    addOutput([{ type: 'input', text: trimmed }]);

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (cmd === 'help') {
      const lines = Object.entries(COMMANDS).map(([k, v]) => `  ${k.padEnd(12)} ${v.desc}`);
      addOutput([
        { type: 'system', text: 'Available commands:' },
        { type: 'output', text: lines.join('\n') },
        { type: 'system', text: '\nBuilt-in: help, clear, history' },
      ]);
      return;
    }

    if (cmd === 'clear') {
      setHistory([{ type: 'system', text: 'Terminal cleared.' }]);
      return;
    }

    if (cmd === 'history') {
      addOutput([{ type: 'output', text: cmdHistory.slice(0, 20).map((c, i) => `  ${i + 1}. ${c}`).join('\n') || '  (empty)' }]);
      return;
    }

    const command = COMMANDS[cmd];
    if (!command) {
      addOutput([{ type: 'error', text: `Unknown command: ${cmd}. Type "help" for available commands.` }]);
      return;
    }

    if (!args.length && command.usage.includes(' ')) {
      const requiredArg = command.usage.split(' ')[1];
      if (!requiredArg.startsWith('[')) {
        addOutput([{ type: 'error', text: `Usage: ${command.usage}` }]);
        return;
      }
    }

    setLoading(true);
    try {
      const path = command.path(args.map((a) => a.toUpperCase()));
      const data = await apiClient.get(`${API_BASE}${path}`);
      addOutput([{ type: 'output', text: formatResponse(data) }]);
    } catch (e) {
      addOutput([{ type: 'error', text: e.message || 'Request failed' }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      execute(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(histIdx + 1, cmdHistory.length - 1);
      setHistIdx(next);
      if (cmdHistory[next]) setInput(cmdHistory[next]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = histIdx - 1;
      if (next < 0) { setHistIdx(-1); setInput(''); }
      else { setHistIdx(next); setInput(cmdHistory[next] || ''); }
    }
  };

  return (
    <BaseWidget
      title="Terminal"
      icon={Terminal}
      loading={false}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div
        className="flex flex-col h-full bg-[#0a0a0f] font-mono text-[11px]"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex-1 overflow-auto px-3 py-2 space-y-0.5">
          {history.map((entry, i) => (
            <div key={i} className={`whitespace-pre-wrap ${
              entry.type === 'input'  ? 'text-cyan-400' :
              entry.type === 'error'  ? 'text-red-400' :
              entry.type === 'system' ? 'text-gray-500' :
              'text-gray-300'
            }`}>
              {entry.type === 'input' ? `> ${entry.text}` : entry.text}
            </div>
          ))}
          {loading && <div className="text-gray-500 animate-pulse">Processing...</div>}
          <div ref={bottomRef} />
        </div>

        <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-800">
          <Terminal size={12} className="text-cyan-500 flex-shrink-0" />
          <span className="text-cyan-500">{'>'}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-gray-200 outline-none placeholder-gray-600"
            autoFocus
          />
        </div>
      </div>
    </BaseWidget>
  );
}

function formatResponse(data) {
  if (!data || typeof data !== 'object') return String(data);

  if (Array.isArray(data)) {
    return formatTable(data.slice(0, 20));
  }

  const flat = {};
  let hasNested = false;
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
      hasNested = true;
      flat[k] = `[${v.length} items]`;
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      hasNested = true;
      flat[k] = JSON.stringify(v).slice(0, 80);
    } else {
      flat[k] = v;
    }
  }

  if (hasNested) {
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
        return formatTable(v.slice(0, 20));
      }
    }
  }

  const maxKey = Math.max(...Object.keys(flat).map((k) => k.length), 0);
  return Object.entries(flat)
    .map(([k, v]) => `  ${k.padEnd(maxKey + 2)} ${fmtVal(v)}`)
    .join('\n');
}

function formatTable(rows) {
  if (!rows.length) return '  (empty)';
  const keys = Object.keys(rows[0]).slice(0, 8);
  const widths = keys.map((k) =>
    Math.max(k.length, ...rows.map((r) => String(fmtVal(r[k])).length))
  );
  widths.forEach((w, i) => { widths[i] = Math.min(w, 20); });

  const header = keys.map((k, i) => k.slice(0, 20).padEnd(widths[i])).join('  ');
  const sep = widths.map((w) => '─'.repeat(w)).join('──');
  const body = rows.map((r) =>
    keys.map((k, i) => String(fmtVal(r[k])).slice(0, 20).padEnd(widths[i])).join('  ')
  );
  return `  ${header}\n  ${sep}\n${body.map((l) => `  ${l}`).join('\n')}`;
}

function fmtVal(v) {
  if (v == null) return '—';
  if (typeof v === 'number') {
    if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
    if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
    if (Number.isInteger(v)) return v.toLocaleString();
    return v.toFixed(2);
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 40);
  return String(v);
}
