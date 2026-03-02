/**
 * CompanyRelationsWidget - Supply-chain / competitor / partner radial network graph
 */
import { useState, useEffect, useCallback } from 'react';
import { Network } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import { API_BASE } from './constants';

// ── Visual config per node type ─────────────────────────────────────────────
const TYPE_CFG = {
  supplier_t1: { label: 'Tier-1 Supplier', color: '#22d3ee', r: 150, arcStart: 140, arcEnd: 220 },
  supplier_t2: { label: 'Tier-2 Supplier', color: '#818cf8', r: 230, arcStart: 125, arcEnd: 235 },
  competitor:  { label: 'Competitor',       color: '#f87171', r: 170, arcStart: 280, arcEnd: 400 },
  customer:    { label: 'Customer',         color: '#4ade80', r: 155, arcStart:  45, arcEnd: 135 },
  partner:     { label: 'Partner',          color: '#fb923c', r: 145, arcStart: 210, arcEnd: 275 },
};

const CENTER_COLOR = '#facc15';
const NODE_RADIUS  = 24;
const SVG_W        = 560;
const SVG_H        = 520;
const CX           = SVG_W / 2;
const CY           = SVG_H / 2;

function degToRad(d) { return (d * Math.PI) / 180; }

/** Spread `nodes` of `type` evenly along its arc, return [{...node, x, y}] */
function placeNodes(nodes, type) {
  const cfg = TYPE_CFG[type];
  if (!cfg || nodes.length === 0) return [];
  const start = degToRad(cfg.arcStart);
  const end   = degToRad(cfg.arcEnd);
  const step  = nodes.length === 1 ? 0 : (end - start) / (nodes.length - 1);
  return nodes.map((n, i) => {
    const angle = start + i * step;
    return {
      ...n,
      x: CX + cfg.r * Math.cos(angle),
      y: CY + cfg.r * Math.sin(angle),
      color: cfg.color,
    };
  });
}

/** Shorten a name for the SVG label */
function shortName(name = '') {
  const words = name.replace(/\(.*?\)/g, '').trim().split(/\s+/);
  if (words.length <= 2) return words.join('\n');
  return words.slice(0, 2).join('\n') + '…';
}

export default function CompanyRelationsWidget({ symbol: initialSymbol = 'AAPL', onRemove }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover]   = useState(null);   // hovered node object
  const [filter, setFilter] = useState('all');   // 'all' | type key

  useEffect(() => { setSymbol(initialSymbol); }, [initialSymbol]);

  const load = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/relations/${symbol}`);
      if (res.ok) setData(await res.json());
      else setData(null);
    } catch (e) {
      console.error('CompanyRelationsWidget error:', e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { load(); }, [load]);

  // ── Build positioned nodes ────────────────────────────────────────────────
  const allNodes = data?.nodes || [];
  const grouped  = {};
  for (const type of Object.keys(TYPE_CFG)) {
    grouped[type] = allNodes.filter(n => n.type === type);
  }
  const positioned = Object.entries(grouped).flatMap(([type, nodes]) =>
    placeNodes(nodes, type)
  );
  const visible = filter === 'all' ? positioned : positioned.filter(n => n.type === filter);

  const centerName  = data?.name || symbol;
  const found       = data?.found !== false;
  const dataSource  = data?.data_source;   // 'curated' | 'sec_edgar' | 'yahoo_finance'

  return (
    <BaseWidget
      title="Company Relations"
      icon={Network}
      iconColor="text-cyan-400"
      symbol={symbol}
      onSymbolChange={(s) => { setSymbol(s); setHover(null); setFilter('all'); }}
      loading={loading}
      onRefresh={load}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Filter pills */}
        <div className="flex flex-wrap gap-1 px-3 pt-1.5 pb-1 flex-shrink-0">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-0.5 rounded text-[10px] transition-colors ${filter === 'all' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >All</button>
          {Object.entries(TYPE_CFG).map(([key, cfg]) => {
            const count = grouped[key]?.length || 0;
            if (count === 0) return null;
            return (
              <button
                key={key}
                onClick={() => setFilter(key === filter ? 'all' : key)}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${filter === key ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                style={filter === key ? { backgroundColor: cfg.color + '33', color: cfg.color } : {}}
              >
                <span style={{ color: cfg.color }}>●</span> {cfg.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Data source badge */}
        {found && data && (
          <div className="flex items-center gap-1.5 px-3 pb-1 flex-shrink-0">
            {dataSource === 'db_fmp_peers' && (
              <span className="text-[9px] text-cyan-600 border border-cyan-900 px-1.5 py-0.5 rounded">
                DB · FMP Peer Groups (S&amp;P 500)
              </span>
            )}
            {dataSource === 'yahoo_finance' && (
              <span className="text-[9px] text-gray-600 border border-gray-800 px-1.5 py-0.5 rounded">
                Yahoo Finance · Real-time fallback
              </span>
            )}
          </div>
        )}

        {!found && (
          <div className="text-center text-gray-500 text-xs py-6">
            No data available for <span className="text-gray-300 font-medium">{symbol}</span>.
          </div>
        )}

        {found && (
          <div className="flex-1 min-h-0 relative">
            {/* SVG network */}
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="w-full h-full"
              style={{ maxHeight: '100%' }}
            >
              {/* Edges */}
              {visible.map((n, i) => (
                <line
                  key={`edge-${i}`}
                  x1={CX} y1={CY}
                  x2={n.x} y2={n.y}
                  stroke={n.color}
                  strokeWidth={hover?.symbol === n.symbol ? 1.5 : 0.7}
                  strokeOpacity={hover ? (hover.symbol === n.symbol ? 0.9 : 0.15) : 0.4}
                  strokeDasharray={n.type === 'supplier_t2' ? '4 3' : undefined}
                />
              ))}

              {/* Center node */}
              <circle cx={CX} cy={CY} r={NODE_RADIUS + 4} fill="#1c1c2e" stroke={CENTER_COLOR} strokeWidth="2" />
              <text x={CX} y={CY - 3} textAnchor="middle" fill={CENTER_COLOR} fontSize="10" fontWeight="bold">{symbol}</text>
              <text x={CX} y={CY + 10} textAnchor="middle" fill="#9ca3af" fontSize="7">
                {(centerName || '').split(' ').slice(0, 2).join(' ')}
              </text>

              {/* Satellite nodes */}
              {visible.map((n, i) => {
                const isHovered = hover?.symbol === n.symbol;
                const lines = shortName(n.name).split('\n');
                return (
                  <g
                    key={`node-${i}`}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(null)}
                  >
                    <circle
                      cx={n.x} cy={n.y}
                      r={NODE_RADIUS}
                      fill={isHovered ? n.color + '22' : '#13131f'}
                      stroke={n.color}
                      strokeWidth={isHovered ? 2 : 1}
                      opacity={hover && !isHovered ? 0.35 : 1}
                    />
                    <text
                      x={n.x} y={n.y - (lines.length > 1 ? 5 : 0)}
                      textAnchor="middle"
                      fill={isHovered ? '#fff' : n.color}
                      fontSize="7.5"
                      fontWeight="600"
                      opacity={hover && !isHovered ? 0.35 : 1}
                    >{lines[0]}</text>
                    {lines[1] && (
                      <text
                        x={n.x} y={n.y + 8}
                        textAnchor="middle"
                        fill={isHovered ? '#e5e7eb' : '#9ca3af'}
                        fontSize="7"
                        opacity={hover && !isHovered ? 0.35 : 1}
                      >{lines[1]}</text>
                    )}
                    {/* Symbol label below node */}
                    <text
                      x={n.x} y={n.y + NODE_RADIUS + 10}
                      textAnchor="middle"
                      fill={n.color}
                      fontSize="7"
                      fontWeight="bold"
                      opacity={hover && !isHovered ? 0.2 : 0.8}
                    >{n.symbol}</text>
                  </g>
                );
              })}
            </svg>

            {/* Hover tooltip */}
            {hover && (
              <div
                className="absolute bottom-2 left-2 right-2 mx-auto max-w-xs bg-gray-900 border border-gray-700 rounded-lg p-2 pointer-events-none shadow-xl"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: hover.color + '22', color: hover.color }}
                  >{TYPE_CFG[hover.type]?.label}</span>
                  <span className="text-white text-[11px] font-semibold">{hover.symbol}</span>
                </div>
                <p className="text-gray-300 text-[11px] font-medium">{hover.name}</p>
                <p className="text-gray-500 text-[10px] mt-0.5">{hover.detail}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
