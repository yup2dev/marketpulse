import React, { useState } from 'react';
import {
  Database, TrendingUp, Shield, FlaskConical,
  ChevronDown, ChevronRight, Save,
  BarChart2, DollarSign, Globe, Newspaper,
  Info, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Sub-tabs ──────────────────────────────────────────────────────────────────
const SUB_TABS = [
  { id: 'data',     label: 'Data Inputs',    Icon: Database },
  { id: 'alpha',    label: 'Alpha Factors',  Icon: TrendingUp },
  { id: 'risk',     label: 'Risk',           Icon: Shield },
  { id: 'backtest', label: 'Backtest Env',   Icon: FlaskConical },
];

// ── Data Source Definitions ───────────────────────────────────────────────────
const DATA_SOURCES = [
  {
    id: 'priceVolume',
    label: 'Price & Volume',
    desc: 'OHLCV — 가격 및 거래량 기본 데이터',
    status: 'available',
    Icon: BarChart2,
    vars: [
      { id: 'open',   label: 'Open',   desc: '시가 (O)' },
      { id: 'high',   label: 'High',   desc: '고가 (H)' },
      { id: 'low',    label: 'Low',    desc: '저가 (L)' },
      { id: 'close',  label: 'Close',  desc: '종가 (C)' },
      { id: 'volume', label: 'Volume', desc: '거래량 (V)' },
    ],
  },
  {
    id: 'fundamental',
    label: 'Fundamental Data',
    desc: '재무 지표 — 기업 내재 가치',
    status: 'external',
    Icon: DollarSign,
    vars: [
      { id: 'pe',             label: 'P/E Ratio',     desc: '주가수익비율' },
      { id: 'pb',             label: 'P/B Ratio',     desc: '주가순자산비율' },
      { id: 'ps',             label: 'P/S Ratio',     desc: '주가매출비율' },
      { id: 'ev_ebitda',      label: 'EV/EBITDA',    desc: '기업가치/상각전이익' },
      { id: 'roe',            label: 'ROE (%)',       desc: '자기자본이익률' },
      { id: 'revenue_growth', label: 'Rev. Growth',  desc: '매출 성장률 YoY (%)' },
      { id: 'eps_growth',     label: 'EPS Growth',   desc: 'EPS 성장률 YoY (%)' },
      { id: 'debt_equity',    label: 'D/E Ratio',    desc: '부채비율' },
      { id: 'fcf_yield',      label: 'FCF Yield',    desc: '잉여현금흐름 수익률 (%)' },
    ],
  },
  {
    id: 'macro',
    label: 'Macro Data',
    desc: '거시 경제 지표 — 시장 전체 흐름 변수',
    status: 'external',
    Icon: Globe,
    vars: [
      { id: 'fed_rate',      label: 'Fed Funds Rate',   desc: '연방기금금리 (%)' },
      { id: 'cpi',           label: 'CPI (Inflation)',  desc: '소비자물가지수 YoY (%)' },
      { id: 'dxy',           label: 'USD Index (DXY)',  desc: '달러 인덱스' },
      { id: 'gdp_growth',    label: 'GDP Growth',       desc: 'GDP 성장률 QoQ (%)' },
      { id: 'yield_10y',     label: '10Y Treasury',     desc: '미국 10년 국채 수익률' },
      { id: 'yield_spread',  label: 'Yield Spread',     desc: '10Y-2Y 스프레드 (수익률 곡선 기울기)' },
      { id: 'vix',           label: 'VIX',              desc: '변동성 공포지수' },
      { id: 'credit_spread', label: 'Credit Spread',    desc: 'HY 크레딧 스프레드 (bps)' },
    ],
  },
  {
    id: 'alternative',
    label: 'Alternative Data',
    desc: '대안 데이터 — 비전통 신호',
    status: 'external',
    Icon: Newspaper,
    vars: [
      { id: 'news_sentiment', label: 'News Sentiment', desc: '뉴스 감성 점수 (−1~+1)' },
      { id: 'news_volume',    label: 'News Volume',    desc: '기사 수 (시장 관심도 대리)' },
      { id: 'insider_tx',     label: 'Insider Txns.',  desc: '내부자 순매수 방향' },
      { id: 'short_interest', label: 'Short Interest', desc: '공매도 비율 (%)' },
      { id: 'options_pcr',    label: 'Put/Call Ratio', desc: '옵션 풋콜 비율' },
    ],
  },
];

// ── Alpha Factor Categories ───────────────────────────────────────────────────
const ALPHA_CATEGORIES = [
  {
    id: 'value',
    label: 'Value',
    desc: 'P/E, P/S, EV/EBITDA — 저평가 종목 선별',
    color: 'text-cyan-400',
    activeBorder: 'border-cyan-800/50',
    activeBg: 'bg-cyan-900/10',
    factors: [
      { id: 'pe_rank',   label: 'P/E Rank',    desc: '섹터 내 P/E 백분위 순위' },
      { id: 'pb_rank',   label: 'P/B Rank',    desc: '섹터 내 P/B 백분위 순위' },
      { id: 'ps',        label: 'P/S Ratio',   desc: '주가매출비율 (낮을수록 저평가)' },
      { id: 'ev_ebitda', label: 'EV/EBITDA',  desc: '기업가치 배수 (낮을수록 저평가)' },
      { id: 'pfcf',      label: 'P/FCF',       desc: '잉여현금흐름 대비 주가' },
    ],
    params: [
      { name: 'lookback_q', label: 'Lookback (Quarters)', default: 4, min: 1, max: 12 },
    ],
  },
  {
    id: 'momentum',
    label: 'Momentum',
    desc: '12M 수익률, 상대 강도 — 상승 추세 종목',
    color: 'text-yellow-400',
    activeBorder: 'border-yellow-800/50',
    activeBg: 'bg-yellow-900/10',
    factors: [
      { id: 'ret_12m',  label: '12M Return',        desc: '12개월 누적 수익률 (최근 1개월 제외)' },
      { id: 'ret_6m',   label: '6M Return',          desc: '6개월 누적 수익률' },
      { id: 'ret_3m',   label: '3M Return',          desc: '3개월 누적 수익률' },
      { id: 'rel_str',  label: 'Relative Strength',  desc: '벤치마크 대비 상대 누적 수익률' },
      { id: 'roc',      label: 'Rate of Change',     desc: 'n일 가격 변화율 (%)' },
    ],
    params: [
      { name: 'skip_m', label: 'Skip Recent (months)', default: 1, min: 0, max: 3 },
    ],
  },
  {
    id: 'quality',
    label: 'Quality',
    desc: '부채비율, 이익 변동성 — 재무 건전성',
    color: 'text-green-400',
    activeBorder: 'border-green-800/50',
    activeBg: 'bg-green-900/10',
    factors: [
      { id: 'roe',          label: 'ROE',                desc: '자기자본이익률 (높을수록 선호)' },
      { id: 'roa',          label: 'ROA',                desc: '총자산이익률' },
      { id: 'gross_margin', label: 'Gross Margin',       desc: '매출총이익률 (%)' },
      { id: 'debt_equity',  label: 'D/E Ratio',          desc: '부채비율 (낮을수록 선호)' },
      { id: 'earn_stab',    label: 'Earnings Stability', desc: 'EPS 표준편차 — 이익 변동성 (낮을수록 선호)' },
    ],
    params: [
      { name: 'lookback_q', label: 'Lookback (Quarters)', default: 8, min: 2, max: 20 },
    ],
  },
  {
    id: 'low_vol',
    label: 'Low Volatility',
    desc: '표준편차, Beta — 가격 안정성 선별',
    color: 'text-purple-400',
    activeBorder: 'border-purple-800/50',
    activeBg: 'bg-purple-900/10',
    factors: [
      { id: 'hist_vol',     label: 'Historical Vol.',    desc: '롤링 수익률 표준편차 (낮을수록 선호)' },
      { id: 'beta',         label: 'Beta',               desc: '시장 수익률 민감도 (낮을수록 선호)' },
      { id: 'downside_dev', label: 'Downside Dev.',      desc: '하방 편차만 측정 (낮을수록 선호)' },
      { id: 'max_dd_hist',  label: 'Max DD (Hist.)',     desc: '이력 최대 낙폭' },
    ],
    params: [
      { name: 'window', label: 'Window (days)', default: 252, min: 60, max: 504 },
    ],
  },
  {
    id: 'size',
    label: 'Size',
    desc: '시가총액 — 소형주 초과수익 효과',
    color: 'text-orange-400',
    activeBorder: 'border-orange-800/50',
    activeBg: 'bg-orange-900/10',
    factors: [
      { id: 'market_cap', label: 'Market Cap',      desc: '시가총액 (소형주 효과: 소형 선호)' },
      { id: 'free_float', label: 'Free Float Cap',  desc: '유동 시가총액' },
      { id: 'adv_usd',    label: 'Avg Daily Vol.',  desc: '일평균 거래대금 ($)' },
    ],
    params: [],
  },
];

// ── Position Sizing Options ───────────────────────────────────────────────────
const POSITION_SIZING = [
  { id: 'equal',        label: 'Equal Weight',    desc: '모든 종목 동일 비중' },
  { id: 'vol_adjusted', label: 'Vol-Adjusted',    desc: '변동성 역비례 — 1/σ 가중' },
  { id: 'factor_score', label: 'Factor Score',    desc: '팩터 점수 비례 가중' },
  { id: 'custom',       label: 'Custom % (Fixed)', desc: '종목당 고정 비중 (%)' },
];

const REBALANCING = [
  { id: 'daily',     label: 'Daily' },
  { id: 'weekly',    label: 'Weekly' },
  { id: 'monthly',   label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
];

const UNIVERSES = [
  { id: 'SP500',    label: 'S&P 500' },
  { id: 'SP1500',   label: 'S&P 1500' },
  { id: 'Russell3000', label: 'Russell 3000' },
  { id: 'CUSTOM',   label: 'Custom List' },
];

// ── Default State ─────────────────────────────────────────────────────────────
const buildDefaultDataState = () => {
  const s = {};
  DATA_SOURCES.forEach(src => {
    const vars = {};
    src.vars.forEach(v => { vars[v.id] = src.id === 'priceVolume'; });
    s[src.id] = { enabled: src.id === 'priceVolume', expanded: src.id === 'priceVolume', vars };
  });
  return s;
};

const buildDefaultAlphaState = () => {
  const s = {};
  ALPHA_CATEGORIES.forEach(cat => {
    const factors = {};
    cat.factors.forEach((f, i) => { factors[f.id] = i < 2; });
    const params = {};
    cat.params.forEach(p => { params[p.name] = p.default; });
    s[cat.id] = { enabled: cat.id === 'momentum', expanded: cat.id === 'momentum', factors, params };
  });
  return s;
};

const DEFAULT_RISK = {
  positionSizing: 'equal',
  customPct: 5,
  stopLoss: 8,
  takeProfit: 20,
  rebalancing: 'monthly',
  maxDrawdown: 20,
};

const DEFAULT_BACKTEST = {
  commission: 0.1,
  slippage: 5,
  lookAheadBias: true,
  survivorshipBias: true,
  startDate: '2020-01-01',
  endDate: '2024-12-31',
  initialCapital: 100000,
  universe: 'SP500',
};

// ── Shared UI Primitives ──────────────────────────────────────────────────────
const Toggle = ({ checked, onChange, disabled }) => (
  <button
    onClick={() => !disabled && onChange(!checked)}
    className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${
      disabled
        ? 'bg-gray-800 cursor-not-allowed'
        : checked
          ? 'bg-cyan-600'
          : 'bg-gray-700'
    }`}
  >
    <span className={`absolute top-0.5 w-3 h-3 rounded-full transition-transform ${
      checked ? 'translate-x-4 bg-white' : 'translate-x-0.5 bg-gray-500'
    }`} />
  </button>
);

const Checkbox = ({ checked, onChange, label, desc }) => (
  <label className="flex items-start gap-2 cursor-pointer group py-0.5">
    <div
      onClick={() => onChange(!checked)}
      className={`mt-0.5 w-3 h-3 rounded-sm border shrink-0 flex items-center justify-center transition-colors ${
        checked ? 'bg-cyan-600 border-cyan-500' : 'border-gray-600 group-hover:border-gray-400'
      }`}
    >
      {checked && <span className="text-[8px] text-white font-bold leading-none">✓</span>}
    </div>
    <div className="min-w-0">
      <span className="text-[11px] text-gray-300">{label}</span>
      {desc && <div className="text-[10px] text-gray-600">{desc}</div>}
    </div>
  </label>
);

const NumInput = ({ label, value, onChange, min, max, step = 1, unit }) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] text-gray-400 min-w-0 flex-1">{label}</span>
    <div className="flex items-center gap-1 shrink-0">
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-20 px-2 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white text-right focus:outline-none focus:border-cyan-500 tabular-nums"
      />
      {unit && <span className="text-[10px] text-gray-600 w-6">{unit}</span>}
    </div>
  </div>
);

const StatusBadge = ({ status }) =>
  status === 'external' ? (
    <span className="text-[9px] px-1.5 py-0.5 rounded border border-yellow-800/60 text-yellow-500 bg-yellow-900/20 shrink-0">
      ext.
    </span>
  ) : (
    <span className="text-[9px] px-1.5 py-0.5 rounded border border-green-800/60 text-green-500 bg-green-900/20 shrink-0">
      live
    </span>
  );

const SectionHeader = ({ label, open, onToggle, children }) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center gap-1.5 py-1 text-left"
  >
    {open
      ? <ChevronDown size={11} className="text-gray-600 shrink-0" />
      : <ChevronRight size={11} className="text-gray-600 shrink-0" />}
    {children}
    <span className="text-[10px] font-semibold text-gray-300">{label}</span>
  </button>
);

// ── Data Inputs Tab ───────────────────────────────────────────────────────────
const DataInputsTab = ({ state, setState }) => {
  const toggleSource = (srcId) => {
    setState(prev => ({
      ...prev,
      [srcId]: { ...prev[srcId], enabled: !prev[srcId].enabled },
    }));
  };
  const toggleExpand = (srcId) => {
    setState(prev => ({
      ...prev,
      [srcId]: { ...prev[srcId], expanded: !prev[srcId].expanded },
    }));
  };
  const toggleVar = (srcId, varId) => {
    setState(prev => ({
      ...prev,
      [srcId]: {
        ...prev[srcId],
        vars: { ...prev[srcId].vars, [varId]: !prev[srcId].vars[varId] },
      },
    }));
  };
  const toggleAllVars = (srcId, val) => {
    setState(prev => {
      const vars = {};
      Object.keys(prev[srcId].vars).forEach(k => { vars[k] = val; });
      return { ...prev, [srcId]: { ...prev[srcId], vars } };
    });
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-gray-600 px-1 pb-1">
        전략의 기초가 되는 원천 데이터를 설정합니다. 외부 연동(ext.) 데이터는 별도 구성이 필요합니다.
      </div>
      {DATA_SOURCES.map(src => {
        const srcState = state[src.id];
        const Ico = src.Icon;
        const enabledCount = Object.values(srcState.vars).filter(Boolean).length;

        return (
          <div
            key={src.id}
            className={`border rounded-lg overflow-hidden transition-colors ${
              srcState.enabled
                ? 'border-gray-700 bg-[#060608]'
                : 'border-gray-800/50 bg-transparent opacity-60'
            }`}
          >
            {/* Source Header */}
            <div className="flex items-center gap-2 px-3 py-2.5">
              <button
                onClick={() => toggleExpand(src.id)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                {srcState.expanded
                  ? <ChevronDown size={11} className="text-gray-600 shrink-0" />
                  : <ChevronRight size={11} className="text-gray-600 shrink-0" />}
                <Ico size={12} className={srcState.enabled ? 'text-cyan-400' : 'text-gray-600'} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold text-gray-200">{src.label}</div>
                  <div className="text-[10px] text-gray-600 truncate">{src.desc}</div>
                </div>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={src.status} />
                <span className="text-[10px] text-gray-600 tabular-nums w-10 text-right">
                  {enabledCount}/{src.vars.length}
                </span>
                <Toggle
                  checked={srcState.enabled}
                  onChange={() => toggleSource(src.id)}
                />
              </div>
            </div>

            {/* Variable List */}
            {srcState.expanded && (
              <div className="px-3 pb-3 border-t border-gray-800/60">
                <div className="flex items-center justify-between pt-2 pb-1.5">
                  <span className="text-[9px] text-gray-600 uppercase tracking-wide">입력 변수</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleAllVars(src.id, true)}
                      className="text-[9px] text-cyan-600 hover:text-cyan-400"
                    >
                      All
                    </button>
                    <button
                      onClick={() => toggleAllVars(src.id, false)}
                      className="text-[9px] text-gray-600 hover:text-gray-400"
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3">
                  {src.vars.map(v => (
                    <Checkbox
                      key={v.id}
                      checked={srcState.vars[v.id]}
                      onChange={val => toggleVar(src.id, v.id)}
                      label={v.label}
                      desc={v.desc}
                    />
                  ))}
                </div>
                {src.status === 'external' && (
                  <div className="mt-2 flex items-start gap-1.5 text-[10px] text-yellow-600/80 border border-yellow-800/30 rounded px-2 py-1.5 bg-yellow-900/10">
                    <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                    외부 데이터 연동 시 활성화됩니다
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Alpha Factors Tab ─────────────────────────────────────────────────────────
const AlphaFactorsTab = ({ state, setState }) => {
  const toggleCat = (catId) => {
    setState(prev => ({
      ...prev,
      [catId]: { ...prev[catId], enabled: !prev[catId].enabled },
    }));
  };
  const toggleExpand = (catId) => {
    setState(prev => ({
      ...prev,
      [catId]: { ...prev[catId], expanded: !prev[catId].expanded },
    }));
  };
  const toggleFactor = (catId, fId) => {
    setState(prev => ({
      ...prev,
      [catId]: {
        ...prev[catId],
        factors: { ...prev[catId].factors, [fId]: !prev[catId].factors[fId] },
      },
    }));
  };
  const setParam = (catId, name, val) => {
    setState(prev => ({
      ...prev,
      [catId]: {
        ...prev[catId],
        params: { ...prev[catId].params, [name]: val },
      },
    }));
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-gray-600 px-1 pb-1">
        초과 수익(알파)을 만들기 위한 팩터를 정의합니다. 활성화된 팩터를 조합해 종목을 스코어링합니다.
      </div>
      {ALPHA_CATEGORIES.map(cat => {
        const catState = state[cat.id];
        const activeFactors = Object.values(catState.factors).filter(Boolean).length;

        return (
          <div
            key={cat.id}
            className={`border rounded-lg overflow-hidden transition-colors ${
              catState.enabled
                ? `${cat.activeBorder} ${cat.activeBg}`
                : 'border-gray-800/50 bg-transparent opacity-60'
            }`}
          >
            {/* Category Header */}
            <div className="flex items-center gap-2 px-3 py-2.5">
              <button
                onClick={() => toggleExpand(cat.id)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                {catState.expanded
                  ? <ChevronDown size={11} className="text-gray-600 shrink-0" />
                  : <ChevronRight size={11} className="text-gray-600 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className={`text-[11px] font-semibold ${cat.color}`}>{cat.label}</div>
                  <div className="text-[10px] text-gray-600 truncate">{cat.desc}</div>
                </div>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-gray-600 tabular-nums w-10 text-right">
                  {activeFactors}/{cat.factors.length}
                </span>
                <Toggle
                  checked={catState.enabled}
                  onChange={() => toggleCat(cat.id)}
                />
              </div>
            </div>

            {/* Factor List + Params */}
            {catState.expanded && (
              <div className="px-3 pb-3 border-t border-gray-800/40 space-y-3">
                {/* Factor Checkboxes */}
                <div>
                  <div className="text-[9px] text-gray-600 uppercase tracking-wide pt-2 pb-1.5">팩터 변수</div>
                  <div className="space-y-0.5">
                    {cat.factors.map(f => (
                      <Checkbox
                        key={f.id}
                        checked={catState.factors[f.id]}
                        onChange={val => toggleFactor(cat.id, f.id)}
                        label={f.label}
                        desc={f.desc}
                      />
                    ))}
                  </div>
                </div>

                {/* Params */}
                {cat.params.length > 0 && (
                  <div>
                    <div className="text-[9px] text-gray-600 uppercase tracking-wide pb-1.5">파라미터</div>
                    <div className="space-y-1.5">
                      {cat.params.map(p => (
                        <NumInput
                          key={p.name}
                          label={p.label}
                          value={catState.params[p.name] ?? p.default}
                          onChange={v => setParam(cat.id, p.name, v)}
                          min={p.min}
                          max={p.max}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Risk & Portfolio Tab ──────────────────────────────────────────────────────
const RiskTab = ({ state, setState }) => {
  const set = (key, val) => setState(prev => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-4">
      <div className="text-[10px] text-gray-600 px-1 pb-1">
        포지션 규모와 리스크 한도를 설정합니다. 전략의 생존과 수익 실현을 결정합니다.
      </div>

      {/* Position Sizing */}
      <div className="border border-gray-800 rounded-lg p-3 space-y-2.5 bg-[#060608]">
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">
          Position Sizing — 포지션 사이징
        </div>
        <div className="space-y-1">
          {POSITION_SIZING.map(opt => (
            <label
              key={opt.id}
              className="flex items-start gap-2.5 cursor-pointer group"
            >
              <div
                onClick={() => set('positionSizing', opt.id)}
                className={`mt-0.5 w-3 h-3 rounded-full border shrink-0 flex items-center justify-center transition-colors ${
                  state.positionSizing === opt.id
                    ? 'bg-cyan-600 border-cyan-500'
                    : 'border-gray-600 group-hover:border-gray-400'
                }`}
              >
                {state.positionSizing === opt.id && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                )}
              </div>
              <div>
                <div className="text-[11px] text-gray-300">{opt.label}</div>
                <div className="text-[10px] text-gray-600">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
        {state.positionSizing === 'custom' && (
          <NumInput
            label="종목당 비중"
            value={state.customPct}
            onChange={v => set('customPct', v)}
            min={0.1}
            max={100}
            step={0.5}
            unit="%"
          />
        )}
      </div>

      {/* Stop-loss / Take-profit */}
      <div className="border border-gray-800 rounded-lg p-3 space-y-2.5 bg-[#060608]">
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">
          Stop-loss / Take-profit
        </div>
        <NumInput
          label="손절선 (Stop-loss)"
          value={state.stopLoss}
          onChange={v => set('stopLoss', v)}
          min={0.5}
          max={50}
          step={0.5}
          unit="%"
        />
        <div className="text-[9px] text-gray-700 font-mono">진입 대비 −{state.stopLoss}% 도달 시 청산</div>
        <NumInput
          label="익절선 (Take-profit)"
          value={state.takeProfit}
          onChange={v => set('takeProfit', v)}
          min={1}
          max={200}
          step={1}
          unit="%"
        />
        <div className="text-[9px] text-gray-700 font-mono">진입 대비 +{state.takeProfit}% 도달 시 청산</div>
      </div>

      {/* Rebalancing */}
      <div className="border border-gray-800 rounded-lg p-3 space-y-2 bg-[#060608]">
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">
          Rebalancing Period — 리밸런싱 주기
        </div>
        <div className="grid grid-cols-4 gap-1">
          {REBALANCING.map(opt => (
            <button
              key={opt.id}
              onClick={() => set('rebalancing', opt.id)}
              className={`px-2 py-1.5 text-[10px] rounded border transition-colors ${
                state.rebalancing === opt.id
                  ? 'bg-cyan-900/40 border-cyan-600 text-cyan-300'
                  : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Max Drawdown Limit */}
      <div className="border border-gray-800 rounded-lg p-3 space-y-2 bg-[#060608]">
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">
          Max Drawdown Limit — 최대 낙폭 제한
        </div>
        <NumInput
          label="허용 최대 낙폭"
          value={state.maxDrawdown}
          onChange={v => set('maxDrawdown', v)}
          min={1}
          max={100}
          step={1}
          unit="%"
        />
        <div className="text-[9px] text-gray-700 font-mono">
          전체 자산 대비 −{state.maxDrawdown}% 초과 낙폭 시 전략 일시 중단
        </div>
      </div>
    </div>
  );
};

// ── Backtest Environment Tab ──────────────────────────────────────────────────
const BacktestTab = ({ state, setState }) => {
  const set = (key, val) => setState(prev => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-4">
      <div className="text-[10px] text-gray-600 px-1 pb-1">
        전략 검증 환경을 설정합니다. 현실적인 백테스트 결과를 위해 모든 항목을 세팅하세요.
      </div>

      {/* Universe */}
      <div className="border border-gray-800 rounded-lg p-3 space-y-2 bg-[#060608]">
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">
          Universe — 투자 유니버스
        </div>
        <div className="grid grid-cols-2 gap-1">
          {UNIVERSES.map(opt => (
            <button
              key={opt.id}
              onClick={() => set('universe', opt.id)}
              className={`px-2 py-1.5 text-[10px] rounded border transition-colors ${
                state.universe === opt.id
                  ? 'bg-cyan-900/40 border-cyan-600 text-cyan-300'
                  : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date Range + Capital */}
      <div className="border border-gray-800 rounded-lg p-3 space-y-2.5 bg-[#060608]">
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">
          Simulation Period — 백테스트 기간
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-16 shrink-0">Start Date</span>
          <input
            type="date"
            value={state.startDate}
            onChange={e => set('startDate', e.target.value)}
            className="flex-1 px-2 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-16 shrink-0">End Date</span>
          <input
            type="date"
            value={state.endDate}
            onChange={e => set('endDate', e.target.value)}
            className="flex-1 px-2 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500"
          />
        </div>
        <NumInput
          label="Initial Capital ($)"
          value={state.initialCapital}
          onChange={v => set('initialCapital', v)}
          min={1000}
          max={100000000}
          step={1000}
        />
      </div>

      {/* Transaction Costs */}
      <div className="border border-gray-800 rounded-lg p-3 space-y-2.5 bg-[#060608]">
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">
          Transaction Costs — 거래 비용
        </div>
        <NumInput
          label="Commission (수수료)"
          value={state.commission}
          onChange={v => set('commission', v)}
          min={0}
          max={5}
          step={0.01}
          unit="%"
        />
        <div className="text-[9px] text-gray-700 font-mono">
          매수/매도 시 거래금액의 {state.commission}%를 비용으로 차감
        </div>
        <NumInput
          label="Slippage (슬리피지)"
          value={state.slippage}
          onChange={v => set('slippage', v)}
          min={0}
          max={100}
          step={1}
          unit="bps"
        />
        <div className="text-[9px] text-gray-700 font-mono">
          체결 가격 오차 {state.slippage}bps = {(state.slippage / 100).toFixed(2)}%
        </div>
      </div>

      {/* Bias Prevention */}
      <div className="border border-gray-800 rounded-lg p-3 space-y-3 bg-[#060608]">
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">
          Bias Controls — 편향 방지
        </div>

        <div className="space-y-1">
          <div className="flex items-start gap-2.5">
            <Toggle
              checked={state.lookAheadBias}
              onChange={v => set('lookAheadBias', v)}
            />
            <div>
              <div className="text-[11px] text-gray-300 font-medium">
                Look-ahead Bias 방지
              </div>
              <div className="text-[10px] text-gray-600">
                미래 데이터를 과거 시점에서 알 수 없도록 차단 — 항상 활성화 권장
              </div>
            </div>
          </div>
          {!state.lookAheadBias && (
            <div className="flex items-center gap-1.5 text-[10px] text-red-400 border border-red-800/40 rounded px-2 py-1 bg-red-900/10">
              <AlertTriangle size={10} />
              비활성화 시 백테스트 결과가 과대평가됩니다
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-start gap-2.5">
            <Toggle
              checked={state.survivorshipBias}
              onChange={v => set('survivorshipBias', v)}
            />
            <div>
              <div className="text-[11px] text-gray-300 font-medium">
                Survivorship Bias 포함
              </div>
              <div className="text-[10px] text-gray-600">
                상장폐지된 종목을 과거 데이터에 포함 — 비활성화 시 결과 낙관 편향 발생
              </div>
            </div>
          </div>
          {!state.survivorshipBias && (
            <div className="flex items-center gap-1.5 text-[10px] text-yellow-500 border border-yellow-800/40 rounded px-2 py-1 bg-yellow-900/10">
              <AlertTriangle size={10} />
              상장폐지 종목 제외 — 결과가 과대평가될 수 있습니다
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-1.5 text-[10px] text-gray-600 border border-gray-800/60 rounded px-2.5 py-2">
        <Info size={10} className="shrink-0 mt-0.5" />
        거래 비용과 슬리피지를 간과하면 백테스트 수익이 실제 운용 시 마이너스가 될 수 있습니다.
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const FactorBuilderTab = () => {
  const [activeTab,   setActiveTab]   = useState('data');
  const [dataState,   setDataState]   = useState(buildDefaultDataState);
  const [alphaState,  setAlphaState]  = useState(buildDefaultAlphaState);
  const [riskState,   setRiskState]   = useState(DEFAULT_RISK);
  const [backtestState, setBacktestState] = useState(DEFAULT_BACKTEST);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Config serialization — wire up to API when backend is ready
      const config = {
        dataInputs: dataState,
        alphaFactors: alphaState,
        risk: riskState,
        backtest: backtestState,
      };
      // await quantAPI.saveFactorConfig(config);
      localStorage.setItem('quant_factor_config', JSON.stringify(config));
      toast.success('팩터 구성이 저장되었습니다');
    } catch (err) {
      toast.error('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  // Summary counts for header chips
  const activeDataSources = Object.values(dataState).filter(s => s.enabled).length;
  const activeAlpha = Object.values(alphaState).filter(s => s.enabled).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-white">Factor Studio</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-gray-600">
                Data: <span className="text-cyan-400">{activeDataSources}</span>
              </span>
              <span className="text-gray-700">·</span>
              <span className="text-[10px] text-gray-600">
                Alpha: <span className="text-yellow-400">{activeAlpha}</span>
              </span>
              <span className="text-gray-700">·</span>
              <span className="text-[10px] text-gray-600">
                Rebal: <span className="text-gray-400">{riskState.rebalancing}</span>
              </span>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200 disabled:opacity-50 transition-colors"
          >
            <Save size={11} />
            {saving ? 'Saving…' : 'Save Config'}
          </button>
        </div>
      </div>

      {/* Sub-tab Bar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-800 shrink-0 overflow-x-auto">
        {SUB_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap rounded transition-colors ${
              activeTab === id
                ? 'text-cyan-400 bg-cyan-400/10'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/60'
            }`}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'data'     && (
          <DataInputsTab state={dataState} setState={setDataState} />
        )}
        {activeTab === 'alpha'    && (
          <AlphaFactorsTab state={alphaState} setState={setAlphaState} />
        )}
        {activeTab === 'risk'     && (
          <RiskTab state={riskState} setState={setRiskState} />
        )}
        {activeTab === 'backtest' && (
          <BacktestTab state={backtestState} setState={setBacktestState} />
        )}
      </div>
    </div>
  );
};

export default FactorBuilderTab;
