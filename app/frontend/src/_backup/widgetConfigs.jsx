/**
 * Universal Widget Configs
 *
 * Pure data configuration — no inline React component definitions.
 * Only Tier 1 (columns/chartConfig) and simplified Tier 2
 * (renderBody returning only CommonTable or CommonChart) entries.
 *
 * Tier:
 *   Tier 1 — columns + chartConfig만 정의 (순수 config)
 *   Tier 2 — renderBody(data, state) => CommonTable | CommonChart only
 */

import {
  DollarSign, Scissors, FileText, TrendingUp, TrendingDown, Activity, Building, Percent,
  BarChart3, UserCheck, Users, Briefcase, Flame, Landmark, Building2, Calendar,
  Grid3X3, Shield, Award, Minus, Newspaper, MessageSquare,
  List, Globe,
  ArrowUp, ArrowDown, Bell,
} from 'lucide-react';
import CommonChart from '../components/common/CommonChart';
import CommonTable from '../components/common/CommonTable';
import {
  VerticalBarChart,
  TabBar,
  ProgressBarDisplay,
  KVTable,
  TransactionDisplay,
  StockSentimentBody,
} from '../components/core/widgetPatterns';
import { posNeg, gray, fmtDate, fmtMagnitude, fmtNum } from '../utils/formatUtils';

// Thin wrapper: renderBody에서 CommonChart를 사용하기 위한 helper
function ChartBody({ data, series, xKey, type, xFormatter, yFormatter, referenceLines }) {
  return (
    <CommonChart
      data={data}
      series={series}
      xKey={xKey}
      type={type}
      fillContainer
      xFormatter={xFormatter}
      yFormatter={yFormatter}
      referenceLines={referenceLines}
    />
  );
}

// Governance keys for management widget
const GOVERNANCE_KEYS = [
  { key: 'audit_risk',              label: 'Audit Risk' },
  { key: 'board_risk',              label: 'Board Risk' },
  { key: 'compensation_risk',       label: 'Compensation Risk' },
  { key: 'shareholder_rights_risk', label: 'Shareholder Rights' },
  { key: 'overall_risk',            label: 'Overall Risk' },
];
const riskColor = (v) => !v ? '#6b7280' : v <= 3 ? '#22c55e' : v <= 7 ? '#eab308' : '#ef4444';

// ── UNIVERSAL_WIDGET_CONFIGS ──────────────────────────────────────────────────

export const UNIVERSAL_WIDGET_CONFIGS = {

  // ════════════════════════════════════════════════════════════════
  //  STOCK WIDGETS — Tier 1 (pure config)
  // ════════════════════════════════════════════════════════════════

  'dividend': {
    title: 'Dividends',
    icon: DollarSign,
    iconColor: 'text-green-400',
    endpoint: '/stock/dividends/{symbol}',
    dataPath: ['history', 'dividends'],
    displayType: 'table',
    requiresSymbol: true,
    syncable: true,
    source: 'Yahoo Finance',
    tableOptions: { searchable: false, exportable: true, compact: true, pageSize: 20 },
    columns: [
      { key: 'date', header: 'Date', formatter: 'date' },
      {
        key: 'dividend', header: 'Amount ($)', align: 'right',
        renderFn: (v) => v != null
          ? <span className="text-white">${Number(v).toFixed(4)}</span>
          : <span className="text-gray-500">-</span>,
      },
      {
        key: 'dividend_yield', header: 'Yield (%)', align: 'right',
        renderFn: (v) => v != null
          ? <span className="text-green-500">{(Number(v) * 100).toFixed(2)}%</span>
          : <span className="text-gray-500">-</span>,
      },
      { key: 'yoy_growth', header: 'YoY (%)', align: 'right', renderFn: (v) => posNeg(v) },
    ],
  },

  'stock-splits': {
    title: 'Splits',
    icon: Scissors,
    iconColor: 'text-purple-400',
    endpoint: '/stock/splits/{symbol}',
    dataPath: ['splits'],
    displayType: 'table',
    requiresSymbol: true,
    source: 'Yahoo Finance',
    tableOptions: { searchable: false, exportable: false, compact: true, pageSize: 20 },
    columns: [
      { key: 'date',        header: 'Date', formatter: 'date' },
      { key: 'description', header: 'Split', renderFn: (v) => <span className="text-cyan-400">{v}</span> },
      { key: 'ratio',       header: 'Ratio', align: 'right', renderFn: (v) => <span className="text-white font-medium">{v}:1</span> },
    ],
  },

  'company-filings': {
    title: 'SEC Filings',
    icon: FileText,
    iconColor: 'text-blue-400',
    endpoint: '/stock/filings/{symbol}',
    dataPath: ['filings'],
    displayType: 'table',
    requiresSymbol: true,
    tableOptions: { searchable: true, exportable: false, compact: true, pageSize: 20 },
    columns: [
      { key: 'date', header: 'Date', formatter: 'date' },
      { key: 'type', header: 'Type',  renderFn: (v) => <span className="text-cyan-400 font-medium">{v}</span> },
      { key: 'title', header: 'Description', renderFn: (v) => <span className="text-gray-400 truncate block max-w-[200px] text-[10px]">{v}</span> },
      {
        key: 'url', header: '', align: 'right', sortable: false,
        renderFn: (v) => v
          ? <a href={v} target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400" onClick={(e) => e.stopPropagation()}>View</a>
          : <span className="text-gray-500">-</span>,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  //  MACRO WIDGETS — Tier 1 (pure config, 9개)
  // ════════════════════════════════════════════════════════════════

  'gdp-forecast': {
    title: 'GDP Forecast',
    icon: TrendingUp,
    iconColor: 'text-blue-400',
    endpoint: '/macro/overview/gdp-forecast?period={period}',
    dataPath: 'history',
    displayType: 'both',
    periodType: 'macro',
    defaultPeriod: '3y',
    source: 'Atlanta Fed / BEA',
    chartConfig: {
      type: 'area',
      xKey: 'date',
      series: [{ key: 'value', name: 'GDP Growth', color: '#3b82f6' }],
      xFormatter: fmtDate,
      yFormatter: (v) => `${Number(v).toFixed(2)}%`,
      referenceLines: [{ value: 0, color: '#4b5563', label: '0%' }],
    },
    tableOptions: { searchable: false, exportable: true, compact: true, pageSize: 20 },
    columns: [
      { key: 'date', header: 'Date' },
      {
        key: 'value', header: 'GDP Growth', align: 'right',
        renderFn: (v) => v != null
          ? <span className={v >= 0 ? 'text-green-400' : 'text-red-400'}>{Number(v).toFixed(2)}%</span>
          : <span className="text-gray-500">-</span>,
      },
    ],
  },

  'inflation-momentum': {
    title: 'Inflation Momentum',
    icon: Activity,
    iconColor: 'text-orange-400',
    endpoint: '/macro/overview/inflation-momentum?period={period}',
    dataPath: 'history',
    displayType: 'both',
    periodType: 'macro',
    defaultPeriod: '3y',
    source: 'BLS / FRED',
    chartConfig: {
      type: 'line',
      xKey: 'date',
      series: [
        { key: 'yoy_12m', name: '12M', color: '#3b82f6' },
        { key: 'yoy_6m',  name: '6M',  color: '#f97316' },
        { key: 'yoy_3m',  name: '3M',  color: '#22c55e' },
      ],
      xFormatter: fmtDate,
      yFormatter: (v) => `${Number(v).toFixed(0)}%`,
      referenceLines: [{ value: 2, color: '#f59e0b', label: 'FED 2%' }],
    },
    tableOptions: { searchable: false, exportable: true, compact: true, pageSize: 20 },
    columns: [
      { key: 'date',    header: 'Date' },
      { key: 'yoy_12m', header: '12M (%)', align: 'right', renderFn: (v) => <span className="text-blue-400">{v?.toFixed(2)}%</span> },
      { key: 'yoy_6m',  header: '6M (%)',  align: 'right', renderFn: (v) => <span className="text-orange-400">{v?.toFixed(2)}%</span> },
      { key: 'yoy_3m',  header: '3M (%)',  align: 'right', renderFn: (v) => <span className="text-green-400">{v?.toFixed(2)}%</span> },
    ],
  },

  'initial-claims': {
    title: 'Initial Claims',
    icon: Users,
    iconColor: 'text-cyan-400',
    endpoint: '/macro/overview/initial-claims?period={period}',
    dataPath: 'history',
    displayType: 'both',
    periodType: 'macro',
    defaultPeriod: '2y',
    source: 'DOL / FRED',
    chartConfig: {
      type: 'area',
      xKey: 'date',
      series: [
        { key: 'claims', name: 'Initial Claims', color: '#3b82f6' },
        { key: 'ma_4w',  name: '4W MA',          color: '#ef4444' },
      ],
      xFormatter: fmtDate,
      yFormatter: (v) => `${Number(v).toFixed(0)}K`,
    },
    tableOptions: { searchable: false, exportable: true, compact: true, pageSize: 20 },
    columns: [
      { key: 'date',   header: 'Date' },
      { key: 'claims', header: 'Initial Claims', align: 'right', renderFn: (v) => <span className="text-blue-400">{v?.toLocaleString()}K</span> },
      { key: 'ma_4w',  header: '4W MA',          align: 'right', renderFn: (v) => <span className="text-red-400">{v?.toLocaleString()}K</span> },
    ],
  },

  'jobs-breakdown': {
    title: 'Jobs: Private vs Government',
    icon: Briefcase,
    iconColor: 'text-green-400',
    endpoint: '/macro/overview/jobs-breakdown?period={period}',
    dataPath: 'history',
    displayType: 'both',
    periodType: 'macro',
    defaultPeriod: '5y',
    source: 'BLS / FRED',
    chartConfig: {
      type: 'stackedBar',
      xKey: 'date',
      series: [
        { key: 'government', name: 'Government',    color: '#f97316' },
        { key: 'private',    name: 'Total Private', color: '#22c55e' },
      ],
      xFormatter: fmtDate,
      yFormatter: (v) => `${v > 0 ? '+' : ''}${(v / 1000).toFixed(0)}M`,
      referenceLines: [{ value: 0, color: '#4b5563' }],
    },
    tableOptions: { searchable: false, exportable: true, compact: true, pageSize: 20 },
    columns: [
      { key: 'date',       header: 'Date' },
      { key: 'private',    header: 'Private (%)',    align: 'right', renderFn: (v) => <span className={v >= 0 ? 'text-green-400' : 'text-red-400'}>{v != null ? `${v > 0 ? '+' : ''}${(v / 1000).toFixed(1)}M` : '-'}</span> },
      { key: 'government', header: 'Government (%)', align: 'right', renderFn: (v) => <span className={v >= 0 ? 'text-orange-400' : 'text-red-400'}>{v != null ? `${v > 0 ? '+' : ''}${(v / 1000).toFixed(1)}M` : '-'}</span> },
    ],
  },

  'yield-curve-snapshot': {
    title: 'Yield Curve',
    icon: TrendingUp,
    iconColor: 'text-blue-400',
    endpoint: '/macro/yield-curve',
    dataPath: 'curve',
    displayType: 'both',
    periodType: null,
    source: 'U.S. Treasury',
    chartConfig: {
      type: 'area',
      xKey: 'maturity',
      series: [{ key: 'yield', name: 'Yield', color: '#3b82f6' }],
      yFormatter: (v) => `${v}%`,
    },
    tableOptions: { searchable: false, exportable: true, compact: true, pageSize: 20 },
    columns: [
      { key: 'maturity', header: 'Maturity', renderFn: (v) => <span className="font-medium text-white">{v}</span> },
      { key: 'yield',    header: 'Yield (%)', align: 'right', renderFn: (v) => <span className="text-white">{v?.toFixed(2)}%</span> },
      { key: 'years',    header: 'Years',     align: 'right', renderFn: (v) => <span className="text-gray-400">{v}</span> },
    ],
  },

  'inflation-decomp': {
    title: 'Inflation Decomposition',
    icon: Flame,
    iconColor: 'text-orange-400',
    endpoint: '/macro/inflation/decomposition',
    dataPath: 'components',
    displayType: 'both',
    periodType: null,
    source: 'BLS / FRED',
    chartConfig: {
      type: 'bar',
      xKey: 'category',
      series: [{ key: 'yoy_change', name: 'YoY Change', color: '#f59e0b' }],
      yFormatter: (v) => `${v}%`,
      referenceLines: [{ value: 2, color: '#f59e0b', label: '2% Target' }],
    },
    tableOptions: { searchable: false, exportable: true, compact: true, pageSize: 20 },
    columns: [
      { key: 'category',     header: 'Category',    renderFn: (v) => <span className="font-medium text-white">{v}</span> },
      { key: 'weight',       header: 'Weight (%)',  align: 'right', renderFn: (v) => <span className="text-gray-400">{v?.toFixed(1)}%</span> },
      { key: 'yoy_change',   header: 'YoY (%)',     align: 'right', renderFn: (v) => v != null ? <span className={v >= 0 ? 'text-red-400' : 'text-green-400'}>{v.toFixed(2)}%</span> : <span className="text-gray-500">-</span> },
      { key: 'contribution', header: 'Contribution', align: 'right', renderFn: (v) => <span className="text-blue-400">{v?.toFixed(2)}%</span> },
    ],
  },

  'fed-balance-sheet': {
    title: 'Fed Balance Sheet',
    icon: Landmark,
    iconColor: 'text-cyan-400',
    endpoint: '/macro/fed-balance-sheet?period={period}',
    dataPath: 'series',
    displayType: 'both',
    periodType: 'macro',
    defaultPeriod: '10y',
    source: 'Federal Reserve',
    chartConfig: {
      type: 'area',
      xKey: 'date',
      series: [{ key: 'value', name: 'Fed Assets ($T)', color: '#06b6d4' }],
      xFormatter: fmtDate,
      yFormatter: (v) => `$${Number(v).toFixed(0)}T`,
    },
    tableOptions: { searchable: false, exportable: true, compact: true, pageSize: 20 },
    columns: [
      { key: 'date',  header: 'Date', renderFn: (v) => <span className="text-gray-300">{v}</span> },
      { key: 'value', header: 'Total Assets ($T)', align: 'right', renderFn: (v) => <span className="text-cyan-400">${v?.toFixed(3)}T</span> },
    ],
  },

  'real-rates': {
    title: 'Real Rates — TIPS / Breakeven',
    icon: TrendingUp,
    iconColor: 'text-amber-400',
    endpoint: '/macro/real-rates?period={period}',
    dataPath: 'history',
    displayType: 'both',
    periodType: 'macro',
    defaultPeriod: '5y',
    source: 'FRED',
    chartConfig: {
      type: 'line',
      xKey: 'date',
      series: [
        { key: 'nominal_10y',   name: '10Y Nominal',   color: '#60a5fa' },
        { key: 'real_10y',      name: '10Y Real',      color: '#f59e0b' },
        { key: 'breakeven_10y', name: '10Y Breakeven', color: '#a78bfa' },
      ],
      xFormatter: fmtDate,
      yFormatter: (v) => `${Number(v).toFixed(1)}%`,
      referenceLines: [{ value: 0, color: '#6b7280', label: '0%' }],
    },
    tableOptions: { searchable: false, exportable: true, compact: true, pageSize: 20 },
    columns: [
      { key: 'date',          header: 'Date',      renderFn: (v) => <span className="text-gray-300">{v}</span> },
      { key: 'nominal_10y',   header: '10Y Nom.',  align: 'right', renderFn: (v) => <span className="text-blue-400">{v?.toFixed(3) ?? '-'}%</span> },
      { key: 'real_10y',      header: '10Y Real',  align: 'right', renderFn: (v) => <span className={`font-medium ${(v ?? 0) >= 0 ? 'text-amber-400' : 'text-red-400'}`}>{v?.toFixed(3) ?? '-'}%</span> },
      { key: 'breakeven_10y', header: '10Y BEI',   align: 'right', renderFn: (v) => <span className="text-violet-400">{v?.toFixed(3) ?? '-'}%</span> },
    ],
  },

  'ownership-institutional': {
    title: 'Institutional Holders',
    icon: Building2,
    iconColor: 'text-blue-400',
    endpoint: '/stock/holders/{symbol}',
    dataPath: 'institutional',
    displayType: 'table',
    requiresSymbol: true,
    syncable: true,
    source: 'SEC / Yahoo Finance',
    tableOptions: { searchable: true, exportable: true, compact: true, pageSize: 10 },
    columns: [
      { key: 'name',     header: 'Institution', renderFn: (v) => <span className="text-white">{v}</span> },
      { key: 'shares',   header: 'Shares', align: 'right', sortable: true, formatter: 'magnitude' },
      {
        key: 'value', header: 'Value', align: 'right', sortable: true,
        renderFn: (v) => {
          if (v == null) return '-';
          if (Math.abs(v) >= 1e9) return <span className="text-white">${(v / 1e9).toFixed(2)}B</span>;
          if (Math.abs(v) >= 1e6) return <span className="text-white">${(v / 1e6).toFixed(2)}M</span>;
          return <span className="text-white">${v.toLocaleString()}</span>;
        },
      },
      { key: 'pct_held', header: '% Held', align: 'right', sortable: true, renderFn: (v) => <span className="text-blue-400 font-medium">{v?.toFixed(2)}%</span> },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  //  STOCK WIDGETS — Tier 1 with dataTransform
  // ════════════════════════════════════════════════════════════════

  'earnings-history': {
    title: 'Earnings History',
    icon: Calendar,
    iconColor: 'text-amber-400',
    endpoint: '/stock/earnings/{symbol}',
    dataTransform: (raw) => (raw?.earnings || (Array.isArray(raw) ? raw : [])).map(item => ({
      period:  item.fiscal_period,
      year:    item.fiscal_year,
      eps:     item.eps_actual,
      eps_est: item.eps_estimated,
      revenue: item.revenue_actual,
    })),
    displayType: 'table',
    requiresSymbol: true,
    syncable: true,
    source: 'Yahoo Finance',
    tableOptions: { searchable: false, exportable: true, compact: true, pageSize: 20 },
    columns: [
      {
        key: 'period', header: 'Period',
        renderFn: (v, row) => (
          <span>
            <span className="text-white font-medium">{v}</span>
            {row.year && <span className="text-gray-500 ml-1">{row.year}</span>}
          </span>
        ),
      },
      {
        key: 'eps', header: 'EPS', align: 'right',
        renderFn: (v, row) => {
          if (v == null) return <span className="text-gray-500">-</span>;
          const beat = row.eps_est && v > row.eps_est;
          const miss = row.eps_est && v < row.eps_est;
          return <span className={beat ? 'text-green-500' : miss ? 'text-red-500' : 'text-white'}>{Number(v).toFixed(2)}</span>;
        },
      },
      {
        key: 'eps_est', header: 'Est.', align: 'right',
        renderFn: (v) => v != null ? <span className="text-gray-400">{Number(v).toFixed(2)}</span> : <span className="text-gray-500">-</span>,
      },
      {
        key: 'revenue', header: 'Revenue', align: 'right',
        renderFn: (v) => v == null ? <span className="text-gray-500">-</span> : <span className="text-white">{fmtMagnitude(v)}</span>,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  //  STOCK WIDGETS — Tier 2 (renderBody using TransactionDisplay / ProgressBarDisplay / KVTable)
  // ════════════════════════════════════════════════════════════════

  'insider': {
    title: 'Insider Trading',
    icon: UserCheck,
    iconColor: 'text-purple-400',
    endpoint: '/stock/insider-trading/{symbol}',
    dataPath: null,
    displayType: 'both',
    requiresSymbol: true,
    syncable: true,
    source: 'SEC / OpenBB',
    renderBody: (rawData, { viewMode }) => <TransactionDisplay rawData={rawData} viewMode={viewMode} />,
  },

  'ownership-insider': {
    title: 'Insider Activity',
    icon: UserCheck,
    iconColor: 'text-green-400',
    endpoint: '/stock/insider-trading/{symbol}',
    dataPath: null,
    displayType: 'both',
    requiresSymbol: true,
    syncable: true,
    source: 'SEC / OpenBB',
    renderBody: (rawData, { viewMode }) => <TransactionDisplay rawData={rawData} viewMode={viewMode} />,
  },

  'ownership-overview': {
    title: 'Ownership Overview',
    icon: Users,
    iconColor: 'text-blue-400',
    endpoint: '/stock/holders/{symbol}',
    dataPath: null,
    displayType: 'both',
    requiresSymbol: true,
    syncable: true,
    source: 'SEC / Yahoo Finance',
    renderBody: (rawData, { viewMode }) => {
      const d        = rawData?.summary || {};
      const instPct  = d.institutional_pct || 0;
      const insPct   = d.insider_pct       || 0;
      const shortPct = d.short_interest    || 0;
      const floatPct = d.shares_outstanding && d.float_shares
        ? ((d.float_shares / d.shares_outstanding) * 100).toFixed(1) : '0';

      if (viewMode === 'table') return <KVTable rows={[
        { label: 'Shares Outstanding',      value: fmtNum(d.shares_outstanding) },
        { label: 'Float',                   value: fmtNum(d.float_shares) },
        { label: 'Float %',                 value: `${floatPct}%` },
        { label: 'Institutional Ownership', value: `${instPct.toFixed(1)}%`,  color: 'text-blue-400' },
        { label: 'Insider Ownership',       value: `${insPct.toFixed(1)}%`,   color: 'text-green-400' },
        { label: 'Short % of Float',        value: `${shortPct.toFixed(1)}%`, color: 'text-red-400' },
        { label: 'Avg. Volume',             value: fmtNum(d.avg_volume) },
      ]} />;

      return <ProgressBarDisplay
        items={[
          { label: 'Institutional',  value: instPct,  color: '#3b82f6', textClass: 'text-blue-400'  },
          { label: 'Insider',        value: insPct,   color: '#22c55e', textClass: 'text-green-400' },
          { label: 'Retail / Other', value: Math.max(0, 100 - instPct - insPct), color: '#f59e0b', textClass: 'text-amber-400' },
          { label: 'Short Interest', value: shortPct, color: '#ef4444', textClass: 'text-red-400'   },
        ].filter(b => b.value > 0)}
        footerStats={[
          { label: 'Float %',        value: `${floatPct}%` },
          { label: 'Short Interest', value: `${shortPct.toFixed(1)}%` },
          { label: 'Shares Out',     value: fmtNum(d.shares_outstanding) },
          { label: 'Avg Volume',     value: fmtNum(d.avg_volume) },
        ]}
      />;
    },
  },

  'management': {
    title: 'Management',
    icon: Users,
    iconColor: 'text-purple-400',
    endpoint: '/stock/management/{symbol}',
    dataPath: null,
    displayType: 'table',
    requiresSymbol: true,
    source: 'Yahoo Finance',
    renderBody: (rawData, { activeView, setActiveView }) => {
      const officers = rawData?.officers    || [];
      const gov      = rawData?.governance  || {};
      const tab      = activeView           || 'team';

      return (
        <div className="h-full flex flex-col">
          <TabBar
            tabs={[{ id: 'team', label: 'Executive Team' }, { id: 'governance', label: 'Governance Risk' }]}
            activeTab={tab}
            onSelect={setActiveView}
            activeColor="text-purple-400 border-purple-400"
          />
          <div className="flex-1 overflow-auto p-3">
            {tab === 'team' && (
              officers.length > 0 ? (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#0d0d12]">
                    <tr className="border-b border-gray-800">
                      {['Name', 'Title', 'Age', 'Total Pay', 'Born'].map(h => (
                        <th key={h} className="py-2 px-2 text-left text-gray-400 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {officers.map((row, idx) => (
                      <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-1.5 px-2 text-white">{row.name}</td>
                        <td className="py-1.5 px-2 text-gray-300 text-[10px]">{row.title}</td>
                        <td className="py-1.5 px-2 text-gray-300 text-center">{row.age}</td>
                        <td className="py-1.5 px-2 text-right text-white">{row.total_pay ? `$${(row.total_pay / 1e6).toFixed(1)}M` : 'N/A'}</td>
                        <td className="py-1.5 px-2 text-center text-gray-300">{row.year_born}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center text-gray-500 text-xs py-8">No officer data available</div>
              )
            )}
            {tab === 'governance' && (
              Object.values(gov).every(v => v == null) ? (
                <div className="text-center text-gray-500 text-xs py-8">No governance data available</div>
              ) : (() => {
                const bars = GOVERNANCE_KEYS.map(({ key, label }) => ({ label, value: gov[key] })).filter(b => b.value != null);
                return (
                  <div className="h-full flex flex-col" style={{ minHeight: '160px' }}>
                    <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-2">1 = Low · 10 = High Risk</p>
                    <div className="flex justify-around mb-1">
                      {bars.map(b => (
                        <span key={b.label} className="text-[9px] font-medium tabular-nums flex-1 text-center" style={{ color: riskColor(b.value) }}>
                          {b.value}/10
                        </span>
                      ))}
                    </div>
                    <div className="flex-1 flex items-end justify-around gap-2 min-h-0">
                      {bars.map(b => (
                        <div key={b.label} className="flex-1 flex justify-center items-end h-full">
                          <div className="w-full max-w-[36px] rounded-t transition-all duration-700"
                            style={{ height: `${b.value / 10 * 100}%`, backgroundColor: riskColor(b.value), minHeight: '3px' }} />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-around border-t border-gray-800 pt-1.5 mt-1">
                      {bars.map(b => (
                        <span key={b.label} className="text-[8px] text-gray-500 text-center flex-1 leading-tight">
                          {b.label.replace(' Risk', '')}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      );
    },
  },

  // ════════════════════════════════════════════════════════════════
  //  MACRO WIDGETS — Tier 2 (renderBody using ChartBody / CommonChart)
  // ════════════════════════════════════════════════════════════════

  'yield-trends': {
    title: 'Yield Trends',
    icon: Activity,
    iconColor: 'text-purple-400',
    endpoint: '/macro/yield-curve/history?period={period}',
    dataPath: null,
    displayType: 'both',
    periodType: 'macro',
    defaultPeriod: '2y',
    source: 'FRED / U.S. Treasury',
    renderBody: (rawData, { viewMode, activeView, setActiveView }) => {
      const MATURITIES = [
        { key: '3m',  label: '3M',  color: '#ef4444' },
        { key: '6m',  label: '6M',  color: '#f97316' },
        { key: '1y',  label: '1Y',  color: '#eab308' },
        { key: '2y',  label: '2Y',  color: '#22c55e' },
        { key: '5y',  label: '5Y',  color: '#3b82f6' },
        { key: '10y', label: '10Y', color: '#8b5cf6' },
        { key: '30y', label: '30Y', color: '#ec4899' },
      ];
      const SPREAD_COLORS = { '2y10y': '#3b82f6', '3m10y': '#f97316' };
      const DEFAULT_SEL   = ['2y', '5y', '10y'];

      const isSpread = activeView === 'spreads';
      const selected = (!activeView || isSpread) ? DEFAULT_SEL : activeView.split(',').filter(k => k !== 'spreads');
      const subTab   = isSpread ? 'spreads' : 'yields';

      const setSubTab   = (t)    => { if (t === 'spreads') setActiveView('spreads'); else setActiveView(selected.join(',')); };
      const toggleMat   = (key)  => {
        const next = selected.includes(key)
          ? selected.length > 1 ? selected.filter(k => k !== key) : selected
          : [...selected, key];
        setActiveView(next.join(','));
      };

      const yieldsHistory  = rawData?.yields_history  || [];
      const spreadsHistory = rawData?.spreads_history || [];

      const sample = (arr, max = 200) => {
        if (arr.length <= max) return arr;
        const step = Math.floor(arr.length / max);
        return arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
      };

      const renderChart = () => {
        if (subTab === 'yields') {
          const sampled = sample(yieldsHistory);
          const series  = selected
            .map(key => MATURITIES.find(m => m.key === key))
            .filter(Boolean)
            .map(m => ({ key: m.key, name: m.label, color: m.color }));
          return (
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-1 flex-wrap px-1 pb-1 flex-shrink-0">
                {MATURITIES.map(m => (
                  <button key={m.key} onClick={() => toggleMat(m.key)}
                    className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${selected.includes(m.key) ? 'border' : 'text-gray-500 bg-gray-800/50'}`}
                    style={selected.includes(m.key) ? { backgroundColor: `${m.color}20`, borderColor: `${m.color}50`, color: m.color } : {}}>
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 min-h-0">
                <ChartBody data={sampled} series={series} xKey="date" type="line" xFormatter={fmtDate} yFormatter={(v) => `${v}%`} />
              </div>
            </div>
          );
        }
        return (
          <ChartBody
            data={sample(spreadsHistory)}
            series={[
              { key: '2y10y', name: '2Y-10Y', color: SPREAD_COLORS['2y10y'] },
              { key: '3m10y', name: '3M-10Y', color: SPREAD_COLORS['3m10y'] },
            ]}
            xKey="date" type="line" xFormatter={fmtDate} yFormatter={(v) => `${v}%`}
            referenceLines={[{ value: 0, color: '#4b5563', label: '0%' }]}
          />
        );
      };

      const renderTable = () => {
        const src    = subTab === 'yields' ? [...yieldsHistory].reverse().slice(0, 30) : [...spreadsHistory].reverse().slice(0, 30);
        const cols   = subTab === 'yields' ? selected : ['2y10y', '3m10y'];
        const colors = subTab === 'yields'
          ? Object.fromEntries(selected.map(k => [k, MATURITIES.find(m => m.key === k)?.color || '#6b7280']))
          : SPREAD_COLORS;
        const labels = subTab === 'yields'
          ? Object.fromEntries(selected.map(k => [k, MATURITIES.find(m => m.key === k)?.label || k]))
          : { '2y10y': '2Y-10Y', '3m10y': '3M-10Y' };
        return (
          <div className="overflow-auto h-full">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0d0d12]">
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Date</th>
                  {cols.map(key => (
                    <th key={key} className="text-right py-2 px-3 font-medium" style={{ color: colors[key] }}>{labels[key]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {src.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 px-3 text-gray-300">{row.date}</td>
                    {cols.map(key => (
                      <td key={key} className="py-2 px-3 text-right text-white tabular-nums">
                        {row[key] != null ? `${row[key].toFixed(2)}%` : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      };

      return (
        <div className="h-full flex flex-col">
          <TabBar
            tabs={[{ id: 'yields', label: 'Yield Trends' }, { id: 'spreads', label: 'Spreads' }]}
            activeTab={subTab}
            onSelect={setSubTab}
          />
          <div className="flex-1 min-h-0 p-3">
            {viewMode === 'chart' ? <div className="h-full">{renderChart()}</div> : renderTable()}
          </div>
        </div>
      );
    },
  },

  'inflation-trends': {
    title: 'Inflation Trends',
    icon: TrendingUp,
    iconColor: 'text-orange-400',
    endpoint: '/macro/inflation/sector-history?period={period}',
    dataPath: null,
    displayType: 'both',
    periodType: 'macro',
    defaultPeriod: '3y',
    source: 'FRED / BLS',
    renderBody: (rawData, { viewMode, activeView, setActiveView }) => {
      const FALLBACK_SECTORS = [
        { key: 'headline', name: 'Headline CPI', color: '#6366f1' },
        { key: 'core',     name: 'Core CPI',     color: '#06b6d4' },
        { key: 'food',     name: 'Food',         color: '#f59e0b' },
        { key: 'energy',   name: 'Energy',       color: '#ef4444' },
        { key: 'shelter',  name: 'Shelter',      color: '#8b5cf6' },
        { key: 'medical',  name: 'Medical Care', color: '#10b981' },
        { key: 'apparel',  name: 'Apparel',      color: '#f97316' },
        { key: 'vehicles', name: 'New Vehicles', color: '#ec4899' },
      ];
      const DEFAULT = ['headline', 'core', 'energy', 'shelter'];

      const sectors  = rawData?.sectors || FALLBACK_SECTORS;
      const history  = rawData?.history  || [];
      const selected = activeView ? activeView.split(',') : DEFAULT;

      const toggle = (key) => {
        const next = selected.includes(key)
          ? selected.length > 1 ? selected.filter(k => k !== key) : selected
          : [...selected, key];
        setActiveView(next.join(','));
      };

      const renderChart = () => {
        const series = selected
          .map(key => sectors.find(s => s.key === key))
          .filter(Boolean)
          .map(s => ({ key: s.key, name: s.name, color: s.color }));
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-1 flex-wrap px-1 pb-1 flex-shrink-0">
              {sectors.map(s => (
                <button key={s.key} onClick={() => toggle(s.key)}
                  className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${selected.includes(s.key) ? 'border' : 'text-gray-500 bg-gray-800/50'}`}
                  style={selected.includes(s.key) ? { backgroundColor: `${s.color}20`, borderColor: `${s.color}50`, color: s.color } : {}}>
                  {s.key === 'headline' ? 'CPI' : s.key === 'core' ? 'Core' : s.name}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0">
              <ChartBody data={history.filter(d => d.date)} series={series} xKey="date" type="line"
                xFormatter={fmtDate} yFormatter={(v) => `${v.toFixed(0)}%`}
                referenceLines={[{ value: 2, color: '#f59e0b', label: '2%' }]} />
            </div>
          </div>
        );
      };

      const renderTable = () => {
        const recentData = [...history].reverse().slice(0, 30);
        return (
          <div className="overflow-auto h-full">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0d0d12]">
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Date</th>
                  {selected.map(key => {
                    const s = sectors.find(sec => sec.key === key);
                    return <th key={key} className="text-right py-2 px-3 font-medium" style={{ color: s?.color || '#6b7280' }}>{s?.name || key}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {recentData.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 px-3 text-gray-300">{row.date}</td>
                    {selected.map(key => {
                      const val = row[key];
                      return (
                        <td key={key} className={`py-2 px-3 text-right tabular-nums ${val != null ? (val >= 3 ? 'text-red-400' : val >= 2 ? 'text-yellow-400' : 'text-green-400') : 'text-gray-500'}`}>
                          {val != null ? `${val.toFixed(2)}%` : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      };

      return (
        <div className="h-full p-3">
          {viewMode === 'chart' ? <div className="h-full">{renderChart()}</div> : renderTable()}
        </div>
      );
    },
  },

  'labor-market-dashboard': {
    title: 'Labor Market',
    icon: Users,
    iconColor: 'text-cyan-400',
    endpoint: '/macro/labor/dashboard',
    dataPath: null,
    displayType: 'both',
    periodType: null,
    source: 'BLS / FRED',
    renderBody: (rawData, { viewMode }) => {
      if (!rawData) return <div className="flex items-center justify-center h-full text-gray-500 text-xs">No data</div>;

      const getHeatColor = (v) => v >= 70 ? '#ef4444' : v >= 50 ? '#eab308' : '#22c55e';
      const getHeatText  = (v) => v >= 70 ? 'text-red-400' : v >= 50 ? 'text-yellow-400' : 'text-green-400';

      const barData = [
        ...(rawData.unemployment?.u3 != null               ? [{ name: 'U3',          value: rawData.unemployment.u3,               color: '#3b82f6' }] : []),
        ...(rawData.unemployment?.u6 != null               ? [{ name: 'U6',          value: rawData.unemployment.u6,               color: '#8b5cf6' }] : []),
        ...(rawData.unemployment?.participation_rate != null ? [{ name: 'Participation', value: rawData.unemployment.participation_rate, color: '#06b6d4' }] : []),
        ...(rawData.wages?.hourly_earnings_yoy != null      ? [{ name: 'Wage Growth', value: rawData.wages.hourly_earnings_yoy,      color: '#22c55e' }] : []),
      ];

      if (viewMode === 'chart') {
        return (
          <div className="h-full p-3 flex flex-col">
            <div className="flex items-center gap-3 px-1 pb-2 flex-shrink-0">
              <span className="text-xs text-gray-400">Heat Index:</span>
              <span className={`text-lg font-bold ${getHeatText(rawData.heat_index)}`}>{rawData.heat_index?.toFixed(0) || '-'}</span>
              <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, rawData.heat_index || 0)}%`, backgroundColor: getHeatColor(rawData.heat_index || 0) }} />
              </div>
              {rawData.unemployment?.trend && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  rawData.unemployment.trend === 'improving'    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : rawData.unemployment.trend === 'deteriorating' ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                }`}>{rawData.unemployment.trend.toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <ChartBody data={barData} series={[{ key: 'value', name: 'Value', color: '#3b82f6' }]}
                xKey="name" type="bar" yFormatter={(v) => `${v}%`} />
            </div>
          </div>
        );
      }

      const rows = [
        { section: 'Overview',    metric: 'Labor Heat Index',    value: `${rawData.heat_index?.toFixed(0) || '-'}/100` },
        ...(rawData.unemployment ? [
          { section: 'Unemployment', metric: 'U3 Rate',          value: `${rawData.unemployment.u3?.toFixed(1) || '-'}%` },
          { metric: 'U6 Rate',                                   value: `${rawData.unemployment.u6?.toFixed(1) || '-'}%` },
          { metric: 'Participation Rate',                        value: `${rawData.unemployment.participation_rate?.toFixed(1) || '-'}%` },
        ] : []),
        ...(rawData.job_market ? [
          { section: 'Job Market', metric: 'Nonfarm Payrolls',   value: fmtNum(rawData.job_market.nonfarm_payrolls) },
          { metric: 'Payroll Change (MoM)',                      value: fmtNum(rawData.job_market.payroll_change_mom) },
          { metric: 'JOLTS Openings',                            value: fmtNum(rawData.job_market.jolts_openings) },
          { metric: 'Initial Claims',                            value: fmtNum(rawData.job_market.initial_claims) },
        ] : []),
        ...(rawData.wages ? [
          { section: 'Wages',      metric: 'Hourly Earnings',    value: `$${rawData.wages.hourly_earnings?.toFixed(2) || '-'}` },
          { metric: 'Wage Growth (YoY)',                         value: `${rawData.wages.hourly_earnings_yoy?.toFixed(1) || '-'}%` },
        ] : []),
      ];

      return (
        <div className="overflow-auto h-full">
          <table className="w-full text-xs">
            <tbody>
              {rows.map((row, idx) => (
                <>
                  {row.section && (
                    <tr key={`s-${idx}`} className="border-t border-gray-800">
                      <td colSpan={2} className="py-2 px-3 text-gray-400 text-[10px] font-medium">{row.section}</td>
                    </tr>
                  )}
                  <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 px-3 text-white">{row.metric}</td>
                    <td className="py-2 px-3 text-right text-white tabular-nums">{row.value}</td>
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        </div>
      );
    },
  },

  'pmi': {
    title: 'Business Cycle Indicators',
    icon: Activity,
    iconColor: 'text-amber-400',
    endpoint: '/macro/business-cycle/pmi?period={period}',
    dataPath: null,
    displayType: 'both',
    periodType: 'macro',
    defaultPeriod: '5y',
    source: 'Chicago Fed / FRED',
    renderBody: (rawData, { viewMode, activeView, setActiveView }) => {
      const VIEWS       = ['cfnai', 'diff', 'sahm'];
      const VIEW_LABELS = { cfnai: 'CFNAI', diff: 'Breadth', sahm: 'Sahm Rule' };
      const tab         = activeView || 'cfnai';

      const cfgMap = {
        cfnai: { series: rawData?.cfnai?.series || [], threshold: 0,   mainName: 'CFNAI',         mainColor: '#f59e0b', thresholdLabel: '0 (Expansion)' },
        diff:  { series: rawData?.diff?.series  || [], threshold: 0,   mainName: 'CFNAI Breadth', mainColor: '#60a5fa', thresholdLabel: '0 (Majority Expanding)' },
        sahm:  { series: rawData?.sahm?.series  || [], threshold: 0.5, mainName: 'Sahm Rule',     mainColor: '#f87171', thresholdLabel: '0.5 (Recession)' },
      };
      const cfg = cfgMap[tab];

      let mergedSeries = cfg.series;
      if (tab === 'cfnai' && rawData?.cfnai?.ma3?.length) {
        const ma3Map = Object.fromEntries(rawData.cfnai.ma3.map(d => [d.date, d.value]));
        mergedSeries = cfg.series.map(d => ({ ...d, ma3: ma3Map[d.date] ?? null }));
      }

      const latestCfnai = rawData?.cfnai?.latest;
      const tableData   = [...cfg.series].reverse().slice(0, 36);

      const renderChart = () => {
        const chartSeries = [{ key: 'value', name: cfg.mainName, color: cfg.mainColor }];
        if (tab === 'cfnai') chartSeries.push({ key: 'ma3', name: '3M MA', color: '#a78bfa' });
        return (
          <ChartBody
            data={mergedSeries} series={chartSeries} xKey="date" type="area"
            xFormatter={fmtDate} yFormatter={(v) => Number(v).toFixed(2)}
            referenceLines={[{ value: cfg.threshold, color: '#6b7280', label: cfg.thresholdLabel }]}
          />
        );
      };

      return (
        <div className="h-full flex flex-col">
          <div className="flex gap-1 px-3 pt-1 pb-1 flex-shrink-0">
            {VIEWS.map(v => (
              <button key={v} onClick={() => setActiveView(v)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  tab === v ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'border-gray-700 text-gray-500 hover:text-gray-300'
                }`}>
                {VIEW_LABELS[v]}
              </button>
            ))}
            <div className="ml-auto flex gap-3 text-[10px] items-center">
              {latestCfnai && (
                <span className={latestCfnai.value >= 0 ? 'text-green-400' : 'text-red-400'}>
                  CFNAI {latestCfnai.value.toFixed(3)}
                </span>
              )}
              {rawData?.sahm?.recession_signal && <span className="text-red-400 font-medium">⚠ Sahm</span>}
            </div>
          </div>
          <div className="flex-1 px-1 pb-2 min-h-0">
            {viewMode === 'chart' ? renderChart() : (
              <div className="overflow-auto h-full">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#0d0d12]">
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-2 px-3 text-gray-400">Date</th>
                      <th className="text-right py-2 px-3 text-gray-400">{VIEW_LABELS[tab]}</th>
                      <th className="text-right py-2 px-3 text-gray-400">Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row, idx) => {
                      const expanding = tab === 'sahm' ? row.value < 0.5 : row.value >= 0;
                      return (
                        <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="py-1.5 px-3 text-gray-300">{row.date}</td>
                          <td className={`py-1.5 px-3 text-right font-medium tabular-nums ${expanding ? 'text-green-400' : 'text-red-400'}`}>
                            {row.value?.toFixed(3)}
                          </td>
                          <td className={`py-1.5 px-3 text-right text-[10px] ${expanding ? 'text-green-500' : 'text-red-500'}`}>
                            {tab === 'sahm' ? (row.value >= 0.5 ? '⚠ Recession' : 'Normal') : (expanding ? 'Expansion' : 'Contraction')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      );
    },
  },

  // ════════════════════════════════════════════════════════════════
  //  MACRO WIDGETS — Tier 2 (tab dashboards using CommonTable)
  // ════════════════════════════════════════════════════════════════

  'fin-conditions-tab': {
    title: 'Financial Conditions',
    icon: Activity,
    iconColor: 'text-cyan-400',
    endpoint: '/macro/financial-conditions',
    dataPath: null,
    source: 'Federal Reserve',
    renderBody: (rawData, { activeView, setActiveView }) => {
      if (!rawData) return <div className="flex items-center justify-center py-20 text-gray-500 text-sm">No data available</div>;

      const COND = {
        tight:   { label: 'TIGHT',   cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
        loose:   { label: 'LOOSE',   cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
        neutral: { label: 'NEUTRAL', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
      };
      const condLevel = (v) => v == null ? 'neutral' : v > 0.5 ? 'tight' : v < -0.5 ? 'loose' : 'neutral';
      const CondBadge = ({ signal }) => {
        if (!signal) return <span className="text-gray-500">-</span>;
        const b = COND[signal] || COND.neutral;
        return <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${b.cls}`}>{b.label}</span>;
      };

      const fciValue = rawData?.fci_composite?.value ?? rawData?.fci_index;
      const fciChange = rawData?.fci_composite?.change ?? rawData?.fci_change;
      const igSpread  = rawData?.credit_spreads?.investment_grade?.spread ?? rawData?.ig_spread;
      const igChange  = rawData?.credit_spreads?.investment_grade?.change ?? rawData?.ig_spread_change;
      const hySpread  = rawData?.credit_spreads?.high_yield?.spread ?? rawData?.hy_spread;
      const hyChange  = rawData?.credit_spreads?.high_yield?.change ?? rawData?.hy_spread_change;
      const tedSpread = rawData?.liquidity?.ted_spread ?? rawData?.ted_spread;
      const vixValue  = rawData?.volatility?.vix ?? rawData?.vix;

      const overviewData = [];
      if (fciValue  != null) overviewData.push({ metric: 'FCI Composite', display: fciValue.toFixed(2), changeValue: fciChange, changeDisplay: fciChange?.toFixed(2) || '-', signal: condLevel(fciValue) });
      if (igSpread  != null) overviewData.push({ metric: 'IG Spread',     display: `${igSpread.toFixed(0)} bps`, changeValue: igChange, changeDisplay: igChange != null ? `${igChange.toFixed(0)} bps` : '-', signal: igSpread > 150 ? 'tight' : igSpread < 80 ? 'loose' : 'neutral' });
      if (hySpread  != null) overviewData.push({ metric: 'HY Spread',     display: `${hySpread.toFixed(0)} bps`, changeValue: hyChange, changeDisplay: hyChange != null ? `${hyChange.toFixed(0)} bps` : '-', signal: hySpread > 400 ? 'tight' : hySpread < 300 ? 'loose' : 'neutral' });
      if (tedSpread != null) overviewData.push({ metric: 'TED Spread',    display: `${tedSpread.toFixed(0)} bps`, changeValue: null, changeDisplay: '-', signal: tedSpread > 50 ? 'tight' : tedSpread < 20 ? 'loose' : 'neutral' });
      if (vixValue  != null) overviewData.push({ metric: 'VIX',           display: vixValue.toFixed(1), changeValue: null, changeDisplay: '-', signal: vixValue > 25 ? 'tight' : vixValue < 15 ? 'loose' : 'neutral' });

      const buildHealth = (obj) => !obj ? [] : Object.entries(obj).map(([k, v]) => ({
        metric: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        display: typeof v === 'object' && v !== null ? (v.value != null ? v.value.toFixed(2) : JSON.stringify(v)) : typeof v === 'number' ? v.toFixed(2) : String(v),
      }));
      const consumerData  = buildHealth(rawData?.consumer_health);
      const corporateData = buildHealth(rawData?.corporate_health);

      const tabs = [{ id: 'overview', label: 'Overview' }];
      if (consumerData.length  > 0) tabs.push({ id: 'consumer',  label: 'Consumer Health' });
      if (corporateData.length > 0) tabs.push({ id: 'corporate', label: 'Corporate Health' });
      const view = activeView || 'overview';

      const OVERVIEW_COLS = [
        { key: 'metric',       header: 'Metric',  renderFn: (v) => <span className="text-white">{v}</span> },
        { key: 'display',      header: 'Value',   align: 'right', renderFn: (v) => <span className="text-white tabular-nums font-medium">{v}</span> },
        { key: 'changeDisplay', header: 'Change', align: 'right', renderFn: (v, row) => {
          if (row.changeValue == null) return <span className="text-gray-500">-</span>;
          const color = row.changeValue > 0 ? 'text-red-400' : row.changeValue < 0 ? 'text-green-400' : 'text-gray-400';
          return <span className={`tabular-nums ${color}`}>{row.changeValue > 0 ? '+' : ''}{v}</span>;
        }},
        { key: 'signal', header: 'Signal', align: 'right', renderFn: (v) => <CondBadge signal={v} /> },
      ];
      const HEALTH_COLS = [
        { key: 'metric',  header: 'Metric', renderFn: (v) => <span className="text-white">{v}</span> },
        { key: 'display', header: 'Value',  align: 'right', renderFn: (v) => <span className="text-white tabular-nums">{v}</span> },
      ];

      return (
        <div className="h-full flex flex-col">
          {tabs.length > 1 && (
            <TabBar tabs={tabs.map(t => ({ id: t.id, label: t.label }))} activeTab={view} onSelect={setActiveView} />
          )}
          <div className="flex-1 overflow-auto">
            {view === 'overview' ? (
              <CommonTable columns={OVERVIEW_COLS} data={overviewData} searchable={false} exportable={false} compact pageSize={20} />
            ) : view === 'consumer' ? (
              <CommonTable columns={HEALTH_COLS} data={consumerData} searchable={false} exportable={false} compact pageSize={20} />
            ) : (
              <CommonTable columns={HEALTH_COLS} data={corporateData} searchable={false} exportable={false} compact pageSize={20} />
            )}
          </div>
        </div>
      );
    },
  },

  'sentiment-tab': {
    title: 'Market Sentiment',
    icon: Flame,
    iconColor: 'text-orange-400',
    endpoint: '/macro/sentiment/composite',
    dataPath: null,
    source: 'CNN / AAII / CBOE',
    renderBody: (rawData, { activeView, setActiveView }) => {
      if (!rawData) return <div className="flex items-center justify-center py-20 text-gray-500 text-sm">No data available</div>;

      const SENT = {
        greed: { label: 'GREED', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
        fear:  { label: 'FEAR',  cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
        neutral: { label: 'NEUTRAL', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
        'extreme greed': { label: 'EXT GREED', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
        'extreme fear':  { label: 'EXT FEAR',  cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
        bullish: { label: 'BULLISH', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
        bearish: { label: 'BEARISH', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
      };
      const sentLevel = (v) => v == null ? 'neutral' : v >= 80 ? 'extreme greed' : v >= 60 ? 'greed' : v >= 40 ? 'neutral' : v >= 20 ? 'fear' : 'extreme fear';
      const SignalBadge = ({ signal }) => {
        if (!signal) return <span className="text-gray-500">-</span>;
        const b = SENT[signal] || { label: signal.toUpperCase(), cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
        return <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${b.cls}`}>{b.label}</span>;
      };

      const compositeScore = rawData?.fear_greed_index?.value ?? rawData?.composite_score;
      const aaiiBulls   = rawData?.positioning?.aaii_sentiment?.bullish ?? rawData?.aaii_bulls;
      const aaiiBears   = rawData?.positioning?.aaii_sentiment?.bearish ?? rawData?.aaii_bears;
      const aaiiNeutral = rawData?.positioning?.aaii_sentiment?.neutral  ?? rawData?.aaii_neutral;
      const putCall     = rawData?.fear_greed_index?.components?.put_call_ratio?.value ?? rawData?.put_call;
      const vixValue    = rawData?.volatility?.vix ?? rawData?.vix;
      const fgComponents = rawData?.fear_greed_index?.components;

      const overviewData = [];
      if (compositeScore != null) overviewData.push({ metric: 'Fear & Greed Index', display: compositeScore.toFixed(0), signal: sentLevel(compositeScore) });
      if (aaiiBulls   != null) overviewData.push({ metric: 'AAII Bullish', display: `${aaiiBulls.toFixed(1)}%`,   signal: aaiiBulls > 45 ? 'bullish' : aaiiBulls < 25 ? 'bearish' : 'neutral' });
      if (aaiiBears   != null) overviewData.push({ metric: 'AAII Bearish', display: `${aaiiBears.toFixed(1)}%`,   signal: aaiiBears > 45 ? 'bearish' : aaiiBears < 25 ? 'bullish' : 'neutral' });
      if (aaiiNeutral != null) overviewData.push({ metric: 'AAII Neutral', display: `${aaiiNeutral.toFixed(1)}%` });
      if (aaiiBulls != null && aaiiBears != null) {
        const sp = aaiiBulls - aaiiBears;
        overviewData.push({ metric: 'Bull-Bear Spread', display: `${sp > 0 ? '+' : ''}${sp.toFixed(1)}%`, signal: sp > 20 ? 'bullish' : sp < -20 ? 'bearish' : 'neutral' });
      }
      if (putCall  != null) overviewData.push({ metric: 'Put/Call Ratio', display: putCall.toFixed(2), signal: putCall > 1 ? 'fear' : putCall < 0.7 ? 'greed' : 'neutral' });
      if (vixValue != null) overviewData.push({ metric: 'VIX',            display: vixValue.toFixed(1), signal: vixValue > 25 ? 'fear' : vixValue < 15 ? 'greed' : 'neutral' });

      const compData = !fgComponents ? [] : Object.entries(fgComponents).map(([k, comp]) => {
        const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const display = typeof comp === 'object' && comp !== null ? (comp.value != null ? comp.value.toFixed(2) : '-') : typeof comp === 'number' ? comp.toFixed(2) : String(comp);
        return { label, display, signal: typeof comp === 'object' ? comp.signal : null };
      });
      const aaiiData = [
        ...(aaiiBulls   != null ? [{ category: 'Bullish', type: 'bullish', rawValue: aaiiBulls,   display: `${aaiiBulls.toFixed(1)}%` }] : []),
        ...(aaiiNeutral != null ? [{ category: 'Neutral', type: 'neutral', rawValue: aaiiNeutral, display: `${aaiiNeutral.toFixed(1)}%` }] : []),
        ...(aaiiBears   != null ? [{ category: 'Bearish', type: 'bearish', rawValue: aaiiBears,   display: `${aaiiBears.toFixed(1)}%` }] : []),
      ];

      const tabs = [{ id: 'overview', label: 'Overview' }];
      if (compData.length > 0) tabs.push({ id: 'components', label: 'F&G Components' });
      if (aaiiData.length > 0) tabs.push({ id: 'aaii',       label: 'AAII Survey' });
      const view = activeView || 'overview';

      const OVERVIEW_COLS = [
        { key: 'metric',  header: 'Metric',  renderFn: (v) => <span className="text-white">{v}</span> },
        { key: 'display', header: 'Value',   align: 'right', renderFn: (v) => <span className="text-white tabular-nums font-medium">{v}</span> },
        { key: 'signal',  header: 'Signal',  align: 'right', renderFn: (v) => <SignalBadge signal={v} /> },
      ];
      const COMP_COLS = [
        { key: 'label',   header: 'Component', renderFn: (v) => <span className="text-white">{v}</span> },
        { key: 'display', header: 'Value',     align: 'right', renderFn: (v) => <span className="text-white tabular-nums">{v}</span> },
        { key: 'signal',  header: 'Signal',    align: 'right', renderFn: (v) => <SignalBadge signal={v} /> },
      ];
      const AAII_COLS = [
        { key: 'category', header: 'Category', renderFn: (v, row) => {
          const color = row.type === 'bullish' ? 'text-green-400' : row.type === 'bearish' ? 'text-red-400' : 'text-yellow-400';
          return <span className={`font-medium ${color}`}>{v}</span>;
        }},
        { key: 'display', header: 'Percentage', align: 'right', renderFn: (v) => <span className="text-white tabular-nums font-medium">{v}</span> },
        { key: 'rawValue', header: '', sortable: false, renderFn: (v, row) => {
          const color = row.type === 'bullish' ? 'bg-green-400' : row.type === 'bearish' ? 'bg-red-400' : 'bg-yellow-400';
          return <div className="h-2 bg-gray-700 rounded-full overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${Math.min(v || 0, 100)}%` }} /></div>;
        }},
      ];

      return (
        <div className="h-full flex flex-col">
          {tabs.length > 1 && (
            <TabBar tabs={tabs.map(t => ({ id: t.id, label: t.label }))} activeTab={view} onSelect={setActiveView} />
          )}
          <div className="flex-1 overflow-auto">
            {view === 'overview' ? (
              <CommonTable columns={OVERVIEW_COLS} data={overviewData} searchable={false} exportable={false} compact pageSize={20} />
            ) : view === 'components' ? (
              <CommonTable columns={COMP_COLS} data={compData} searchable={false} exportable={false} compact pageSize={20} />
            ) : (
              <CommonTable columns={AAII_COLS} data={aaiiData} searchable={false} exportable={false} compact pageSize={10} />
            )}
          </div>
        </div>
      );
    },
  },

  'commodities-tab': {
    title: 'FRED Economic Series',
    icon: BarChart3,
    iconColor: 'text-blue-400',
    endpoint: '/macro/fred/series',
    dataPath: 'series',
    source: 'Federal Reserve (FRED)',
    renderBody: (data, { activeView, setActiveView }) => {
      const series = Array.isArray(data) ? data : [];
      const categories = ['all', ...Array.from(new Set(series.map(s => s.category).filter(Boolean))).sort()];
      const active = activeView || 'all';
      const filtered = active === 'all' ? series : series.filter(s => s.category === active);

      const COLUMNS = [
        { key: 'name', header: 'Series', renderFn: (v, row) => (
          <div>
            <div className="text-white font-medium">{v}</div>
            {(row.series_id || row.key) && <div className="text-[10px] text-gray-500">{row.series_id || row.key}</div>}
          </div>
        )},
        { key: 'category', header: 'Category', renderFn: (v) => <span className="text-gray-400">{v || '-'}</span> },
        { key: 'value', header: 'Value', align: 'right', sortable: true, renderFn: (v) => (
          <span className="text-white tabular-nums font-medium">
            {v == null ? '-' : Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        )},
        { key: 'change', header: 'Change', align: 'right', sortable: true, renderFn: (v) => {
          if (v == null) return <span className="text-gray-500">-</span>;
          const color = v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-gray-400';
          return (
            <span className={`flex items-center justify-end gap-1 tabular-nums ${color}`}>
              {v > 0 && <TrendingUp size={12} />}{v < 0 && <TrendingDown size={12} />}
              {v > 0 ? '+' : ''}{Number(v).toFixed(2)}%
            </span>
          );
        }},
        { key: 'date', header: 'Date', align: 'right', renderFn: (v, row) => <span className="text-gray-400">{v || row.observation_date || '-'}</span> },
      ];

      return (
        <div className="h-full flex flex-col">
          {categories.length > 1 && (
            <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800 overflow-x-auto">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveView(cat)}
                  className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded transition-colors ${
                    active === cat ? 'text-cyan-400 bg-cyan-400/10' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {cat === 'all' ? 'All' : cat}
                </button>
              ))}
            </div>
          )}
          <div className="flex-1 overflow-auto">
            <CommonTable columns={COLUMNS} data={filtered} searchable exportable compact pageSize={30} />
          </div>
        </div>
      );
    },
  },

  // ════════════════════════════════════════════════════════════════
  //  STOCK WIDGETS — Tier 2 (renderBody using CommonChart / CommonTable)
  // ════════════════════════════════════════════════════════════════

  'earnings': {
    title: 'Earnings',
    icon: Calendar,
    iconColor: 'text-amber-400',
    endpoint: '/stock/earnings/{symbol}',
    dataPath: 'earnings',
    requiresSymbol: true,
    displayType: 'both',
    source: 'Yahoo Finance',
    renderBody: (data, { viewMode }) => {
      const items = (data || []).slice(0, 8);
      if (!items.length) return <div className="flex items-center justify-center h-full text-gray-500 text-sm">No earnings data</div>;
      if (viewMode === 'chart') {
        const chartData = [...items].reverse().map(item => ({
          period: item.fiscal_period || `Q${item.fiscal_quarter} ${item.fiscal_year}`,
          actual: item.eps_actual,
          estimated: item.eps_estimated,
        }));
        return (
          <div className="p-3 h-full">
            <CommonChart data={chartData} series={[{ key: 'estimated', name: 'Estimated', color: '#6b7280' }, { key: 'actual', name: 'Actual', color: '#22c55e' }]}
              xKey="period" type="bar" fillContainer yFormatter={(v) => `$${v}`} />
          </div>
        );
      }
      return (
        <CommonTable
          columns={[
            { key: 'fiscal_period', header: 'Period', sortable: true,
              renderFn: (v, row) => <div><div className="text-white font-medium">{row.fiscal_period || `Q${row.fiscal_quarter}`}</div><div className="text-[10px] text-gray-500">{row.fiscal_year}</div></div> },
            { key: 'eps_actual',           header: 'Actual',   align: 'right', sortable: true, renderFn: (v) => v != null ? <span className="text-white font-medium">${v.toFixed(2)}</span> : 'N/A' },
            { key: 'eps_estimated',        header: 'Est.',     align: 'right', sortable: true, renderFn: (v) => v != null ? <span className="text-gray-400">${v.toFixed(2)}</span> : 'N/A' },
            { key: 'eps_surprise_percent', header: 'Surprise', align: 'right', sortable: true,
              renderFn: (v) => v == null ? null : <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${v > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{v > 0 ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}{v > 0 ? '+' : ''}{v.toFixed(2)}%</span> },
          ]}
          data={items} compact searchable={false} exportable pageSize={20}
        />
      );
    },
  },

  'swot': {
    title: 'SWOT Analysis',
    icon: Grid3X3,
    iconColor: 'text-emerald-400',
    endpoint: '/stock/swot/{symbol}',
    dataPath: null,
    requiresSymbol: true,
    displayType: 'both',
    source: 'Yahoo Finance',
    renderBody: (data, { viewMode }) => {
      const QC = [
        { key: 'strengths',     label: 'Strengths',     color: '#22c55e', textClass: 'text-green-400'  },
        { key: 'weaknesses',    label: 'Weaknesses',    color: '#ef4444', textClass: 'text-red-400'    },
        { key: 'opportunities', label: 'Opportunities', color: '#3b82f6', textClass: 'text-blue-400'   },
        { key: 'threats',       label: 'Threats',       color: '#f97316', textClass: 'text-orange-400' },
      ];
      const d = data || {};
      const allRows = QC.flatMap(cfg => (d[cfg.key] || []).map(item => ({ ...item, category: cfg.label, _textClass: cfg.textClass })));
      const bars = QC.map(cfg => ({ label: cfg.label, value: (d[cfg.key] || []).length, displayValue: `${(d[cfg.key] || []).length} items`, color: cfg.color, textClass: cfg.textClass }));
      const footer = <div className="flex-shrink-0 border-t border-gray-800 px-4 py-2"><span className="text-[10px] text-gray-600">AI Analysis</span><span className="ml-2 text-[9px] text-gray-700">Coming Soon</span></div>;
      if (viewMode === 'chart') return (
        <div className="h-full flex flex-col">
          <div className="p-3" style={{ height: '160px' }}><VerticalBarChart bars={bars} height={140} /></div>
          <div className="flex-1 overflow-auto border-t border-gray-800 divide-y divide-gray-800/60">
            {allRows.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-1 text-[11px]">
                <span className={`font-medium flex-shrink-0 mr-2 ${item._textClass}`}>{item.category[0]}</span>
                <span className="text-gray-400 truncate flex-1">{item.label}</span>
                <span className={`font-medium tabular-nums ml-2 flex-shrink-0 ${item._textClass}`}>{item.value}</span>
              </div>
            ))}
          </div>
          {footer}
        </div>
      );
      return (
        <div className="h-full flex flex-col">
          <div className="flex-1 min-h-0">
            <CommonTable columns={[
              { key: 'category', header: 'Category', renderFn: (v, row) => <span className={`font-medium text-xs ${row._textClass}`}>{v}</span> },
              { key: 'label',    header: 'Item',     renderFn: (v) => <span className="text-gray-300 text-xs">{v}</span> },
              { key: 'value',    header: 'Value',    align: 'right', renderFn: (v, row) => <span className={`text-xs font-medium tabular-nums ${row._textClass}`}>{v}</span> },
            ]} data={allRows} searchable={false} exportable compact pageSize={50} />
          </div>
          {footer}
        </div>
      );
    },
  },

  'economic-moat': {
    title: 'Economic Moat',
    icon: Shield,
    iconColor: 'text-cyan-400',
    endpoint: '/stock/moat/{symbol}',
    dataPath: null,
    requiresSymbol: true,
    displayType: 'both',
    source: 'Yahoo Finance',
    renderBody: (data, { viewMode }) => {
      const d = data || {};
      const history = d.history || [];
      const moatType = d.moat_type || 'None';
      const moatScore = d.moat_score ?? 0;
      const MOAT_COLOR = { Wide: 'text-cyan-400', Narrow: 'text-yellow-400', None: 'text-gray-400' };
      const METRICS = [
        { key: 'roe',          label: 'ROE',         color: '#22d3ee', textClass: 'text-cyan-400'   },
        { key: 'roic',         label: 'ROIC',        color: '#a78bfa', textClass: 'text-violet-400' },
        { key: 'gross_margin', label: 'Gross %',     color: '#60a5fa', textClass: 'text-blue-400'  },
        { key: 'op_margin',    label: 'Op %',        color: '#4ade80', textClass: 'text-green-400'  },
        { key: 'net_margin',   label: 'Net %',       color: '#facc15', textClass: 'text-yellow-400' },
        { key: 'fcf_margin',   label: 'FCF %',       color: '#fb923c', textClass: 'text-orange-400' },
      ];
      const subHeader = (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 text-xs">
          <span className={`font-semibold ${MOAT_COLOR[moatType] || MOAT_COLOR.None}`}>{moatType} Moat</span>
          <span className="text-gray-500">Score: <span className="text-white font-medium tabular-nums">{moatScore}/100</span></span>
          <span className="ml-auto text-gray-600">ROE consistency · 10 years</span>
        </div>
      );
      if (viewMode === 'chart') {
        if (!history.length) return <div className="flex items-center justify-center h-full text-gray-500 text-xs">No data</div>;
        const latest = history[history.length - 1];
        const bars = METRICS.map(m => ({ ...m, value: latest[m.key] ?? 0, displayValue: `${latest[m.key] ?? 0}%` })).filter(b => b.value != null);
        return <div className="h-full flex flex-col">{subHeader}<div className="flex-1 min-h-0 p-3"><VerticalBarChart bars={bars} height={220} /></div></div>;
      }
      return (
        <div className="h-full flex flex-col">{subHeader}
          <div className="flex-1 min-h-0">
            {history.length > 0
              ? <CommonTable columns={[
                  { key: 'year', header: 'Year', sortable: true },
                  ...METRICS.map(m => ({ key: m.key, header: m.label, sortable: true, align: 'right', renderFn: (v) => v != null ? `${v}%` : '—' })),
                ]} data={history} searchable={false} exportable={false} compact pageSize={15} />
              : <div className="text-center text-gray-500 text-xs py-8">No data</div>}
          </div>
        </div>
      );
    },
  },

  'investment-scorecard': {
    title: 'Investment Scorecard',
    icon: Award,
    iconColor: 'text-amber-400',
    endpoint: '/stock/scorecard/{symbol}',
    dataPath: null,
    requiresSymbol: true,
    source: 'Yahoo Finance',
    renderBody: (data) => {
      const d = data || {};
      const GRADE_CONFIG = {
        'Strong Buy': { color: 'text-green-400' }, 'Buy': { color: 'text-green-300' },
        'Hold': { color: 'text-yellow-400' }, 'Sell': { color: 'text-red-300' },
        'Strong Sell': { color: 'text-red-400' }, 'N/A': { color: 'text-gray-400' },
      };
      const CATS = [
        { key: 'fundamentals', label: 'Fundamentals', color: '#22d3ee' },
        { key: 'growth',       label: 'Growth',       color: '#a78bfa' },
        { key: 'valuation',    label: 'Valuation',    color: '#4ade80' },
        { key: 'sentiment',    label: 'Sentiment',    color: '#f59e0b' },
        { key: 'technical',    label: 'Technical',    color: '#f87171' },
      ];
      const grade = d.investment_grade || 'N/A';
      const overall = d.overall_score ?? 0;
      const cats = d.categories || {};
      const outlook = d.outlook || {};
      const gradeCfg = GRADE_CONFIG[grade] || GRADE_CONFIG['N/A'];
      const catBars = CATS.filter(c => cats[c.key]).map(c => ({ ...c, value: cats[c.key]?.score ?? 0, detail: cats[c.key]?.detail || {}, displayValue: cats[c.key]?.score ?? 0 }));
      return (
        <div className="flex-1 overflow-auto p-3 space-y-4">
          <div className="flex items-center justify-between text-xs border-b border-gray-800 pb-2">
            <span className="text-gray-500">Overall Score</span>
            <div className="flex items-center gap-3">
              <span className={`font-bold text-xl tabular-nums ${gradeCfg.color}`}>{overall}<span className="text-xs text-gray-600 font-normal">/100</span></span>
              <span className={`text-xs font-bold ${gradeCfg.color}`}>{grade}</span>
            </div>
          </div>
          {catBars.length > 0 && <VerticalBarChart bars={catBars} height={140} />}
          {catBars.map(b => (
            <div key={b.key}>
              <div className="flex items-center justify-between mb-0.5 text-xs">
                <span className="font-medium" style={{ color: b.color }}>{b.label}</span>
                <span className="font-bold tabular-nums" style={{ color: b.color }}>{b.value}/100</span>
              </div>
              <div className="space-y-0.5 pl-2">
                {Object.entries(b.detail).slice(0, 3).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-[10px]">
                    <span className="text-gray-600">{k}</span>
                    <span className="text-gray-400 font-medium tabular-nums">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(outlook).length > 0 && (
            <div className="border-t border-gray-800 pt-3">
              <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-2">Outlook</p>
              <div className="flex gap-4">
                {[{ key: 'short_term', label: 'Short' }, { key: 'medium_term', label: 'Medium' }, { key: 'long_term', label: 'Long' }].map(o => (
                  <div key={o.key} className="flex items-center gap-1.5">
                    {outlook[o.key] === 'Positive' ? <TrendingUp size={13} className="text-green-400" /> : outlook[o.key] === 'Negative' ? <TrendingDown size={13} className="text-red-400" /> : <Minus size={13} className="text-gray-400" />}
                    <span className="text-[10px] text-gray-400">{o.label}:</span>
                    <span className="text-[10px] font-medium text-gray-300">{outlook[o.key] || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="border-t border-gray-800 pt-2">
            <span className="text-[10px] text-gray-600">AI Investment Report</span>
            <span className="ml-2 text-[9px] text-gray-700">Coming Soon</span>
          </div>
        </div>
      );
    },
  },

  'stock-sentiment': {
    title: 'News Sentiment',
    icon: Newspaper,
    iconColor: 'text-pink-400',
    endpoint: '/stock/sentiment/{symbol}',
    dataPath: null,
    requiresSymbol: true,
    source: 'Polygon.io',
    renderBody: (data, { activeView, setActiveView }) => (
      <StockSentimentBody data={data} activeView={activeView ?? 'news'} setActiveView={setActiveView} />
    ),
  },

  'social-sentiment': {
    title: 'Social Sentiment',
    icon: MessageSquare,
    iconColor: 'text-indigo-400',
    endpoint: '/stock/reddit/{symbol}',
    dataPath: null,
    requiresSymbol: true,
    source: 'Reddit · StockTwits',
    renderBody: (data, { activeView, setActiveView }) => {
      const tab = activeView ?? 'overview';
      const d = data || {};
      const reddit = d.reddit_posts || [];
      const st     = d.stocktwits_messages || [];
      const agg    = d.aggregate || {};
      const hasReddit = d.has_reddit;
      const TABS = ['overview', 'reddit', 'stocktwits'];
      const ST = { bullish: 'text-green-400', bearish: 'text-red-400', positive: 'text-green-400', negative: 'text-red-400', neutral: 'text-gray-400' };
      return (
        <>
          <TabBar
            tabs={TABS.map(t => ({ id: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
            activeTab={tab}
            onSelect={setActiveView}
            activeColor="text-indigo-400 border-indigo-400"
          />
          <div className="flex-1 overflow-auto p-3">
            {tab === 'overview' && (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="text-gray-500">Total Messages</span>
                  <span className="font-bold tabular-nums text-white">{agg.message_volume ?? 0}</span>
                </div>
                <VerticalBarChart bars={[
                  { label: 'Bullish', value: agg.bullish_pct ?? 0, displayValue: `${(agg.bullish_pct ?? 0).toFixed(1)}%`, color: '#22c55e', textClass: 'text-green-400' },
                  { label: 'Neutral', value: agg.neutral_pct ?? 0, displayValue: `${(agg.neutral_pct ?? 0).toFixed(1)}%`, color: '#6b7280', textClass: 'text-gray-400' },
                  { label: 'Bearish', value: agg.bearish_pct ?? 0, displayValue: `${(agg.bearish_pct ?? 0).toFixed(1)}%`, color: '#ef4444', textClass: 'text-red-400' },
                ]} height={180} />
                {!hasReddit && <p className="text-center text-[10px] text-yellow-600 mt-2">Reddit API key required for full data</p>}
              </div>
            )}
            {tab === 'reddit' && (!hasReddit
              ? <div className="text-center py-8"><p className="text-yellow-400 text-sm font-medium">Reddit API Key Required</p><p className="text-gray-500 text-xs mt-1">Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in .env</p></div>
              : reddit.length > 0
                ? <CommonTable columns={[
                    { key: 'subreddit', header: 'Sub', sortable: true, renderFn: (v) => `r/${v}` },
                    { key: 'title', header: 'Title', renderFn: (v, row) => <a href={row.url} target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 line-clamp-1">{v}</a> },
                    { key: 'score', header: 'Score', sortable: true, align: 'right' },
                    { key: 'sentiment', header: 'Sent.', align: 'center', renderFn: (v) => <span className={`text-[9px] font-medium capitalize ${ST[v] || ST.neutral}`}>{v}</span> },
                  ]} data={reddit} compact searchable={false} pageSize={20} />
                : <div className="text-center text-gray-500 text-xs py-8">No Reddit posts</div>
            )}
            {tab === 'stocktwits' && (st.length > 0
              ? <CommonTable columns={[
                  { key: 'user', header: 'User', sortable: true },
                  { key: 'body', header: 'Message', renderFn: (v) => <span className="line-clamp-2 text-[10px]">{v}</span> },
                  { key: 'sentiment', header: 'Sent.', align: 'center', renderFn: (v) => <span className={`text-[9px] font-medium capitalize ${ST[v] || ST.neutral}`}>{v}</span> },
                  { key: 'created_at', header: 'Time', renderFn: (v) => v ? new Date(v).toLocaleDateString() : '' },
                ]} data={st} compact searchable={false} pageSize={20} />
              : <div className="text-center text-gray-500 text-xs py-8">No StockTwits messages</div>
            )}
          </div>
        </>
      );
    },
  },

  'financials': {
    title: 'Financials',
    icon: BarChart3,
    iconColor: 'text-blue-400',
    endpoint: '/stock/financials/{symbol}',
    dataPath: null,
    requiresSymbol: true,
    displayType: 'both',
    source: 'Yahoo Finance',
    renderBody: (data, { viewMode }) => {
      // Backend returns {symbol, frequency, periods:[{date, income_statement, balance_sheet, cash_flow}]}
      const rawData = data || {};
      const periods = rawData.periods || [];
      const d = periods[0] || rawData; // use most recent period, fallback to root
      const fmt = (num) => {
        if (num == null) return 'N/A';
        const abs = Math.abs(num);
        const sign = num < 0 ? '-' : '';
        if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
        if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
        if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
        return `$${num.toLocaleString()}`;
      };
      if (viewMode === 'chart') {
        const is = d.income_statement || {};
        const bars = [
          { label: 'Revenue',     value: is.revenue || 0,           color: '#3b82f6', textClass: 'text-blue-400'   },
          { label: 'Gross P.',    value: is.gross_profit || 0,      color: '#22c55e', textClass: 'text-green-400'  },
          { label: 'Op. Inc.',    value: is.operating_income || 0,  color: '#a78bfa', textClass: 'text-violet-400' },
          { label: 'Net Inc.',    value: is.net_income || 0,        color: '#4ade80', textClass: 'text-emerald-400' },
          { label: 'EBITDA',      value: is.ebitda || 0,            color: '#f59e0b', textClass: 'text-amber-400'  },
          { label: 'FCF',         value: d.cash_flow?.free_cash_flow || 0, color: '#22d3ee', textClass: 'text-cyan-400' },
        ].filter(b => b.value !== 0).map(b => ({ ...b, displayValue: fmt(b.value) }));
        return bars.length > 0
          ? <div className="overflow-auto h-full p-3"><p className="text-[10px] text-gray-600 uppercase tracking-wide mb-3">Income Statement</p><VerticalBarChart bars={bars} height={220} /></div>
          : <div className="flex items-center justify-center h-full text-gray-500 text-xs">No data</div>;
      }
      const Row = ({ label, value, hi }) => (
        <tr className="border-b border-gray-800 hover:bg-gray-800/30">
          <td className="py-1.5 text-gray-300 text-xs">{label}</td>
          <td className={`text-right py-1.5 text-xs font-medium ${hi ? 'text-green-400' : 'text-white'}`}>{fmt(value)}</td>
        </tr>
      );
      const Sec = ({ title }) => <tr className="border-b border-gray-700"><td colSpan="2" className="py-1.5 text-blue-400 font-semibold text-[10px] uppercase">{title}</td></tr>;
      const is = d.income_statement || {};
      const bs = d.balance_sheet || {};
      const cf = d.cash_flow || {};
      return (
        <div className="overflow-auto h-full">
          <table className="w-full text-xs">
            <tbody>
              <Sec title="Income Statement" />
              <Row label="Revenue" value={is.revenue} /><Row label="Cost of Revenue" value={is.cost_of_revenue} />
              <Row label="Gross Profit" value={is.gross_profit} /><Row label="Operating Income" value={is.operating_income} />
              <Row label="Net Income" value={is.net_income} hi /><Row label="EBITDA" value={is.ebitda} />
              <Row label="EPS (Basic)" value={is.basic_eps} />
              <Sec title="Balance Sheet" />
              <Row label="Total Assets" value={bs.total_assets} /><Row label="Current Assets" value={bs.current_assets} />
              <Row label="Cash" value={bs.cash} /><Row label="Total Liabilities" value={bs.total_liabilities} />
              <Row label="Total Equity" value={bs.total_equity} /><Row label="Total Debt" value={bs.total_debt} />
              <Sec title="Cash Flow" />
              <Row label="Operating CF" value={cf.operating_cash_flow} /><Row label="Free Cash Flow" value={cf.free_cash_flow} hi />
              <Row label="CapEx" value={cf.capital_expenditure} />
            </tbody>
          </table>
        </div>
      );
    },
  },

  // ════════════════════════════════════════════════════════════════
  //  LEGACY chart examples (reference only)
  // ════════════════════════════════════════════════════════════════

  'gdp-forecast-chart': {
    title: 'GDP Forecast',
    icon: BarChart3,
    iconColor: 'text-blue-400',
    endpoint: '/macro/overview/gdp-forecast',
    dataPath: 'history',
    displayType: 'chart',
    periodType: 'macro',
    defaultPeriod: '2y',
    source: 'Atlanta Fed / BEA',
    chartConfig: {
      type: 'bar',
      xKey: 'date',
      series: [
        { key: 'actual',   name: 'Actual',   color: '#3b82f6' },
        { key: 'estimate', name: 'Estimate', color: '#f59e0b' },
      ],
      yFormatter: (v) => `${v}%`,
      xFormatter: (v) => { const d = new Date(v); return isNaN(d) ? v : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); },
    },
  },

  'fed-balance-sheet-mini': {
    title: 'Fed Balance Sheet',
    icon: Building,
    iconColor: 'text-orange-400',
    endpoint: '/macro/fed-balance-sheet',
    dataPath: 'series',
    displayType: 'chart',
    periodType: 'macro',
    defaultPeriod: '3y',
    source: 'Federal Reserve',
    chartConfig: {
      type: 'area',
      xKey: 'date',
      series: [{ key: 'total_assets', name: 'Total Assets', color: '#f97316' }],
      yFormatter: (v) => `$${(v / 1e12).toFixed(1)}T`,
    },
  },

  'real-rates-simple': {
    title: 'Real Rates',
    icon: Percent,
    iconColor: 'text-cyan-400',
    endpoint: '/macro/real-rates',
    dataPath: 'history',
    displayType: 'both',
    periodType: 'macro',
    defaultPeriod: '2y',
    source: 'FRED',
    chartConfig: {
      type: 'line',
      xKey: 'date',
      series: [
        { key: 'real_5y',  name: '5Y Real',  color: '#3b82f6' },
        { key: 'real_10y', name: '10Y Real', color: '#8b5cf6' },
      ],
      yFormatter: (v) => `${v}%`,
    },
    tableOptions: { searchable: false, exportable: true, compact: true, pageSize: 20 },
    columns: [
      { key: 'date',     header: 'Date', formatter: 'date' },
      { key: 'real_5y',  header: '5Y Real (%)',  align: 'right', renderFn: (v) => gray(v != null ? `${Number(v).toFixed(2)}%` : null) },
      { key: 'real_10y', header: '10Y Real (%)', align: 'right', renderFn: (v) => gray(v != null ? `${Number(v).toFixed(2)}%` : null) },
    ],
  },

  // ── Alert Widgets ─────────────────────────────────────────────────────────

  'active-alerts': {
    title: 'Active Alerts',
    icon: Bell,
    iconColor: 'text-yellow-400',
    endpoint: '/alerts/',
    dataPath: null,            // response is already an array
    displayType: 'table',
    columns: [
      {
        key: 'ticker_cd',
        header: 'Ticker',
        renderFn: (v) => v ? <span className="font-mono text-cyan-400 text-xs">{v}</span> : <span className="text-gray-600 text-xs">—</span>,
      },
      { key: 'alert_type',      header: 'Type',      renderFn: (v) => <span className="text-xs capitalize">{v}</span> },
      { key: 'condition_type',  header: 'Condition',  renderFn: (v) => <span className="text-xs capitalize">{v?.replace('_', ' ')}</span> },
      {
        key: 'threshold_value',
        header: 'Threshold',
        align: 'right',
        renderFn: (v) => <span className="tabular-nums text-xs">{v != null ? Number(v).toLocaleString() : '—'}</span>,
      },
      {
        key: 'is_active',
        header: 'Status',
        align: 'center',
        renderFn: (v) => (
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${
            v ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-700 text-gray-500 border-gray-600'
          }`}>
            {v ? 'Active' : 'Paused'}
          </span>
        ),
      },
      {
        key: 'trigger_count',
        header: 'Triggers',
        align: 'right',
        renderFn: (v) => <span className="tabular-nums text-xs text-gray-400">{v ?? 0}</span>,
      },
      {
        key: 'last_triggered',
        header: 'Last Triggered',
        renderFn: (v) => <span className="text-xs text-gray-500">{v ? v.slice(0, 16).replace('T', ' ') : '—'}</span>,
      },
    ],
    tableOptions: { searchable: true, exportable: false, compact: true, pageSize: 20 },
  },

  'alert-history': {
    title: 'Alert History',
    icon: Bell,
    iconColor: 'text-yellow-400',
    endpoint: '/alerts/history',
    dataPath: 'history',
    displayType: 'table',
    columns: [
      {
        key: 'triggered_at',
        header: 'Time',
        sortable: true,
        renderFn: (v) => <span className="tabular-nums text-xs text-gray-300">{v ? v.slice(0, 16).replace('T', ' ') : '—'}</span>,
      },
      { key: 'alert_id',         header: 'Alert ID',  renderFn: (v) => <span className="font-mono text-[10px] text-gray-500">{v?.slice(0, 8)}…</span> },
      {
        key: 'triggered_value',
        header: 'Value',
        align: 'right',
        renderFn: (v) => <span className="tabular-nums text-xs">{v != null ? Number(v).toLocaleString() : '—'}</span>,
      },
      { key: 'message', header: 'Message', renderFn: (v) => <span className="text-xs text-gray-400 truncate max-w-[200px] inline-block">{v || '—'}</span> },
      {
        key: 'is_sent',
        header: 'Sent',
        align: 'center',
        renderFn: (v) => <span className={`text-xs ${v ? 'text-green-400' : 'text-gray-600'}`}>{v ? '✓' : '—'}</span>,
      },
    ],
    tableOptions: { searchable: false, exportable: false, compact: true, pageSize: 30 },
  },

  // ── Quant Widgets ─────────────────────────────────────────────────────────

  'quant-strategies': {
    title: 'Saved Strategies',
    icon: TrendingUp,
    iconColor: 'text-purple-400',
    endpoint: '/quant/strategies',
    dataPath: 'data',
    displayType: 'table',
    columns: [
      { key: 'name',          header: 'Name',     renderFn: (v) => <span className="text-xs font-medium text-white">{v}</span> },
      { key: 'strategy_type', header: 'Type',     renderFn: (v) => <span className="text-xs capitalize text-cyan-400">{v}</span> },
      { key: 'notes',         header: 'Notes',    renderFn: (v) => <span className="text-xs text-gray-400 truncate max-w-[200px] inline-block">{v || '—'}</span> },
      {
        key: 'created_at',
        header: 'Created',
        sortable: true,
        renderFn: (v) => <span className="tabular-nums text-xs text-gray-500">{v ? v.slice(0, 10) : '—'}</span>,
      },
    ],
    tableOptions: { searchable: true, exportable: false, compact: true, pageSize: 20 },
  },

  'quant-factors': {
    title: 'Custom Factors',
    icon: Activity,
    iconColor: 'text-purple-400',
    endpoint: '/quant/factors',
    dataPath: 'data',
    displayType: 'table',
    columns: [
      { key: 'name',        header: 'Factor Name', renderFn: (v) => <span className="text-xs font-medium text-white">{v}</span> },
      { key: 'description', header: 'Description', renderFn: (v) => <span className="text-xs text-gray-400 truncate max-w-[200px] inline-block">{v || '—'}</span> },
      { key: 'formula',     header: 'Formula',     renderFn: (v) => <span className="font-mono text-[10px] text-cyan-300 truncate max-w-[150px] inline-block">{v || '—'}</span> },
      {
        key: 'created_at',
        header: 'Created',
        sortable: true,
        renderFn: (v) => <span className="tabular-nums text-xs text-gray-500">{v ? v.slice(0, 10) : '—'}</span>,
      },
    ],
    tableOptions: { searchable: true, exportable: false, compact: true, pageSize: 20 },
  },
};

export default UNIVERSAL_WIDGET_CONFIGS;
