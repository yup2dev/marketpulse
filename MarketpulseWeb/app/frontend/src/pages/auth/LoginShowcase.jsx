/**
 * LoginShowcase — 로그인 화면 왼쪽 소개 슬라이드 (시안 Login.dc.html).
 *
 * 다섯 장(개요 · 대시보드 · 종목·차트 · 퀀트 · 백테스트)을 자동으로 넘긴다. 아래 진행 막대 · 이전/다음 · 멈춤.
 * 화면 그림은 설명용 예시 — 숫자는 고정 시드로 만든 모양이고 실제 시세가 아니다.
 * 움직임 줄이기(prefers-reduced-motion)면 처음부터 멈춰 있다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

const UP = '#F04452';
const DOWN = '#3182F6';
const tone = (v) => (v > 0 ? UP : v < 0 ? DOWN : '#8A8C95');
const pct = (v, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}%`;
const rng = (seed) => { let q = seed >>> 0; return () => { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; }; };
const gauss = (r) => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());
const walk = (seed, n, drift, vol) => { const r = rng(seed); const out = [0]; for (let i = 1; i < n; i++) out.push(out[i - 1] + drift + vol * gauss(r)); return out; };
const toPts = (arr, w, h, pad = 4) => {
  const lo = Math.min(...arr), hi = Math.max(...arr) || 1;
  return arr.map((v, i) => `${((i / (arr.length - 1)) * w).toFixed(1)},${(h - pad - ((v - lo) / (hi - lo || 1)) * (h - pad * 2)).toFixed(1)}`).join(' ');
};

const SLIDES = [
  { tag: 'OVERVIEW', path: 'marketpulse.app', title: '시장의 흐름을 한 화면에서', desc: '지수·종목·매크로부터 퀀트 전략과 백테스트까지, 필요한 위젯을 내 방식대로 모아 보는 투자 대시보드예요', aria: 'MarketPulse의 네 가지 주요 화면 요약 — 홈 대시보드, 종목·차트, 퀀트, 백테스트', rail: 0 },
  { tag: 'DASHBOARD', path: 'marketpulse.app/home', title: '오늘 시장을 한눈에', desc: '지수·환율·실시간 랭킹·섹터 히트맵·속보를 위젯으로 모아요. 빈 곳을 우클릭하면 원하는 위젯을 더할 수 있어요', aria: '홈 대시보드 화면 예시 — 지수 카드, 실시간 랭킹, 섹터 히트맵, 속보', rail: 0 },
  { tag: 'EQUITY · CHART', path: 'marketpulse.app/stock/AAPL', title: '종목은 숫자와 사건으로', desc: '캔들 차트에 금리·CPI 같은 매크로 지표와 실적·FOMC 일정을 겹쳐 보고, 분기 실적이 왜 변했는지 바로 확인해요', aria: '종목 차트 화면 예시 — 캔들 위 미국 10년물 금리 선, 실적과 FOMC 이벤트 표시, 분기 실적과 비용 증가율', rail: 1 },
  { tag: 'QUANT', path: 'marketpulse.app/quantlib', title: '나만의 전략과 포트폴리오', desc: '팩터와 ML 모델로 종목 점수 규칙을 만들고, 유니버스에서 종목을 골라 포트폴리오를 구성해요', aria: '퀀트 화면 예시 — 팩터 가중치, 포트폴리오 종목, 이번 달 점수 순위와 매수 기준선', rail: 4 },
  { tag: 'BACKTEST', path: 'marketpulse.app/backtest', title: '투자 전에 과거로 검증', desc: '거래비용까지 반영해 누적 수익·낙폭·샤프를 벤치마크와 비교하고, 다음 리밸런싱을 미리 봐요', aria: '백테스트 화면 예시 — 성과 지표, 전략과 S&P 500 누적 수익 비교, 낙폭', rail: 5 },
];

const TILE = 'bg-[#121214] border border-[#1A1B1F] rounded box-border overflow-hidden';
const MK = 'text-[9px] font-semibold tracking-[0.12em] text-[#8A8C95]';
const BAR = 'block h-1.5 rounded-sm bg-[#2A2B31]';

function useData(accent) {
  return useMemo(() => {
    // 1. 개요
    const cR = rng(5); let cp = 30;
    const ovC = Array.from({ length: 14 }, () => { const o = cp; const c = o + (cR() - 0.42) * 8; cp = c; return { o, c }; });
    const cLo = Math.min(...ovC.map((k) => Math.min(k.o, k.c))) - 2, cHi = Math.max(...ovC.map((k) => Math.max(k.o, k.c))) + 2;
    const cy = (v) => 56 - ((v - cLo) / (cHi - cLo)) * 52;
    const ov = [
      { no: '01', tag: 'DASHBOARD', title: '홈 대시보드', rects: [0.72, 0.45, 0.9, 0.3, 0.6].map((v, i) => ({ x: 6 + i * 40, y: 58 - v * 50, w: 26, h: v * 50, c: i === 2 ? accent : '#2A2B31' })), lines: [] },
      { no: '02', tag: 'EQUITY · CHART', title: '종목 · 차트', rects: ovC.map((k, i) => ({ x: 4 + i * 14, y: cy(Math.max(k.o, k.c)), w: 8, h: Math.max(1.5, Math.abs(cy(k.o) - cy(k.c))), c: k.c >= k.o ? UP : DOWN })), lines: [{ pts: toPts(walk(3, 14, 0.2, 1), 200, 60, 10), c: accent, w: 1.6 }] },
      { no: '03', tag: 'QUANT', title: '전략 · 포트폴리오', rects: [0.92, 0.78, 0.64, 0.5, 0.36].map((v, i) => ({ x: 0, y: 4 + i * 11.5, w: v * 200, h: 7, c: i < 3 ? accent : '#2A2B31' })), lines: [] },
      { no: '04', tag: 'BACKTEST', title: '백테스트', rects: [], lines: [{ pts: toPts(walk(12, 40, 0.6, 2.4), 200, 60), c: '#6E7078', w: 1.3 }, { pts: toPts(walk(11, 40, 0.9, 2.2), 200, 60), c: accent, w: 2 }] },
    ];
    // 2. 대시보드
    const idx = [['S&P 500', '7,520.4', 1.89, 21], ['Nasdaq 100', '27,736.4', 2.72, 22], ['KOSPI', '5,018.85', -0.8, 23], ['USD/KRW', '1,345.42', -1.34, 24]]
      .map(([name, v, c, sd]) => ({ name, v, chg: pct(c, 2), c: tone(c), pts: toPts(walk(sd, 14, c / 10, 1), 36, 22, 2) }));
    const rank = [['NVDA', -4.07, 0.95], ['EDSA', 33.64, 0.7], ['INTC', 4.35, 0.6], ['SPCX', 5.49, 0.42], ['AAPL', 2.33, 0.34]]
      .map(([sym, c, w], i) => ({ n: i + 1, sym, chg: pct(c, 1), c: tone(c), w: `${Math.round(w * 100)}%` }));
    const hR = rng(9);
    const heat = Array.from({ length: 18 }, () => {
      const v = (hR() - 0.4) * 10; const a = (0.25 + Math.min(Math.abs(v) / 6, 1) * 0.6).toFixed(2);
      return v >= 0 ? `rgba(240,68,82,${a})` : `rgba(49,130,246,${a})`;
    });
    const news = [['01:18', '78%'], ['01:09', '64%'], ['01:05', '86%']];
    // 3. 종목 · 차트
    const kR = rng(17); let kp = 100; const K = 28;
    const bars = Array.from({ length: K }, () => {
      const o = kp; const c = o * (1 + (kR() - 0.46) * 0.05);
      const h = Math.max(o, c) * (1 + kR() * 0.015); const l = Math.min(o, c) * (1 - kR() * 0.015); kp = c; return { o, c, h, l };
    });
    const kLo = Math.min(...bars.map((b) => b.l)), kHi = Math.max(...bars.map((b) => b.h));
    const ky = (v) => 160 - ((v - kLo) / (kHi - kLo)) * 150;
    const cdl = bars.map((b, i) => {
      const x = 4 + i * 10.6; const t = ky(Math.max(b.o, b.c));
      return { cx: x + 3, x, top: t, h: Math.max(1, ky(Math.min(b.o, b.c)) - t), hi: ky(b.h), lo: ky(b.l), c: b.c >= b.o ? UP : DOWN };
    });
    const macro = toPts(walk(41, K, -0.05, 0.6), 300, 170, 24);
    const evX = [[6, 'F', false], [15, 'C', false], [22, 'E', true]].map(([i, l, e]) => {
      const x = 4 + i * 10.6 + 3; return { x, left: `${((x / 300) * 100).toFixed(1)}%`, l, bg: e ? '#F2F2F0' : '#26272D', fg: e ? '#0E0F12' : '#C9CBD2' };
    });
    const earn = [['매출', '$105.1B', 10.7], ['영업이익', '$23.4B', -20.9], ['순이익', '$13.7B', -45.2]].map(([l, v, c]) => ({ l, v, chg: pct(c), c: tone(c) }));
    const costs = [['연구개발', 32.3, false], ['판관비', 29.1, false], ['매출원가', 18.8, false], ['매출', 10.7, true]]
      .map(([l, v, rv]) => ({ l, v: `+${v.toFixed(1)}%`, w: Math.round((v / 40) * 100), bg: rv ? accent : '#4A4B52' }));
    // 4. 퀀트
    const factors = [['모멘텀 12-1', 50, true], ['저변동성', 30, true], ['이익 수정', 20, true], ['밸류', 0, false], ['사이즈', 0, false]];
    const chips = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'AVGO'];
    const scores = [['AVGO', 0.71], ['AMD', 0.68], ['NVDA', 0.62], ['AAPL', 0.55], ['AMZN', 0.51], ['INTC', 0.43], ['IREN', 0.35]];
    // 5. 백테스트
    const sR = walk(77, 60, 0.95, 2.8), bR = walk(78, 60, 0.7, 3);
    const all = [...sR, ...bR]; const eLo = Math.min(...all, 0) - 2, eHi = Math.max(...all) + 2;
    const ey = (v) => 116 - ((v - eLo) / (eHi - eLo)) * 112;
    const ex = (i) => ((i / 59) * 300).toFixed(1);
    const eqS = sR.map((v, i) => `${ex(i)},${ey(v).toFixed(1)}`).join(' ');
    const eqB = bR.map((v, i) => `${ex(i)},${ey(v).toFixed(1)}`).join(' ');
    let pk = -1e9; const dd = sR.map((v) => { pk = Math.max(pk, v); return v - pk; });
    const ddMin = Math.min(...dd, -1);
    const ddArea = `0,0 ${dd.map((v, i) => `${ex(i)},${((v / ddMin) * 28).toFixed(1)}`).join(' ')} 300,0`;
    const zero = ey(0).toFixed(1);
    const kpis = [['CAGR', '+14.2%', UP, 'BM +10.6%'], ['샤프', '1.08', '#F2F2F0', 'BM 0.71'], ['최대 낙폭', '−18.4%', DOWN, 'BM −24.9%'], ['월 승률', '64%', '#F2F2F0', 'BM 61%']];
    return { ov, idx, rank, heat, news, cdl, macro, evX, earn, costs, factors, chips, scores, eqS, eqB, ddArea, zero, kpis };
  }, [accent]);
}

function Overview({ d }) {
  return (
    <div className="h-full grid grid-cols-2 grid-rows-2 gap-2">
      {d.ov.map((o) => (
        <div key={o.no} className={`${TILE} px-3 py-2.5 flex flex-col gap-1`}>
          <span className={MK}>{o.no} · {o.tag}</span>
          <span className="text-[13px] font-bold">{o.title}</span>
          <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="flex-1 w-full min-h-0 mt-1 block" aria-hidden="true">
            {o.rects.map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={b.c} />)}
            {o.lines.map((l, i) => <polyline key={i} points={l.pts} fill="none" stroke={l.c} strokeWidth={l.w} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
          </svg>
        </div>
      ))}
    </div>
  );
}

function Dashboard({ d }) {
  return (
    <div className="h-full flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-1.5">
        {d.idx.map((x) => (
          <div key={x.name} className={`${TILE} px-2 py-1.5 flex items-center gap-1.5`}>
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="text-[9.5px] text-[#8A8C95] whitespace-nowrap">{x.name}</span>
              <span className="text-[11.5px] font-bold">{x.v}</span>
              <span className="text-[9.5px] font-bold" style={{ color: x.c }}>{x.chg}</span>
            </span>
            <svg width="36" height="22" viewBox="0 0 36 22" aria-hidden="true"><polyline points={x.pts} fill="none" stroke={x.c} strokeWidth="1.3" /></svg>
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-[1.15fr_1fr] gap-1.5">
        <div className={`${TILE} px-2.5 py-2 flex flex-col gap-1.5`}>
          <span className={MK}>실시간 랭킹</span>
          {d.rank.map((r) => (
            <div key={r.sym} className="flex items-center gap-2 text-[10.5px]">
              <span className="w-2.5 text-[#8A8C95]">{r.n}</span>
              <span className="w-10 font-bold">{r.sym}</span>
              <span className={`${BAR} flex-1`} style={{ maxWidth: r.w }} />
              <span className="w-11 text-right font-bold" style={{ color: r.c }}>{r.chg}</span>
            </div>
          ))}
        </div>
        <div className={`${TILE} px-2.5 py-2 flex flex-col gap-1.5`}>
          <span className={MK}>섹터 히트맵</span>
          <div className="flex-1 grid grid-cols-6 grid-rows-3 gap-0.5">
            {d.heat.map((h, i) => <span key={i} className="rounded-sm" style={{ background: h }} />)}
          </div>
        </div>
      </div>
      <div className={`${TILE} px-2.5 py-2 flex flex-col gap-1.5`}>
        <span className={MK}>속보</span>
        {d.news.map(([t, w]) => (
          <div key={t} className="flex items-center gap-2 text-[10px]"><span className="text-[#8A8C95]">{t}</span><span className={BAR} style={{ width: w }} /></div>
        ))}
      </div>
    </div>
  );
}

function Equity({ d, accent }) {
  return (
    <div className="h-full grid grid-cols-[1.55fr_1fr] gap-2">
      <div className={`${TILE} px-2.5 py-2 flex flex-col gap-1`}>
        <span className="flex items-center gap-2.5 text-[10px] text-[#8A8C95]">
          <span className="font-bold text-[#F2F2F0] text-[11px]">AAPL</span>일봉
          <span className="flex items-center gap-1" style={{ color: accent }}><span className="w-3 h-0.5" style={{ background: accent }} />미국 10년물</span>
        </span>
        <svg viewBox="0 0 300 170" preserveAspectRatio="none" className="flex-1 w-full min-h-0 block" aria-hidden="true">
          {d.evX.map((e) => <line key={e.l} x1={e.x} y1="0" x2={e.x} y2="170" stroke="#2E2F36" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />)}
          {d.cdl.map((k, i) => (
            <g key={i}>
              <line x1={k.cx} y1={k.hi} x2={k.cx} y2={k.lo} stroke={k.c} strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <rect x={k.x} y={k.top} width="6" height={k.h} fill={k.c} />
            </g>
          ))}
          <polyline points={d.macro} fill="none" stroke={accent} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="relative h-4 border-t border-[#1A1B1F]">
          {d.evX.map((e) => (
            <span key={e.l} className="absolute top-0.5 -translate-x-1/2 min-w-[13px] h-[13px] px-[3px] box-border rounded-full text-[8.5px] font-bold flex items-center justify-center"
              style={{ left: e.left, background: e.bg, color: e.fg }}>{e.l}</span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 min-h-0">
        <div className={`${TILE} px-2.5 py-2 flex flex-col gap-1`}>
          <span className={MK}>분기 실적 · 전년 대비</span>
          {d.earn.map((r) => (
            <div key={r.l} className="flex items-center text-[10.5px]">
              <span className="flex-1 text-[#C9CBD2]">{r.l}</span>
              <span className="w-[46px] text-right font-bold">{r.v}</span>
              <span className="w-12 text-right font-bold" style={{ color: r.c }}>{r.chg}</span>
            </div>
          ))}
        </div>
        <div className={`${TILE} flex-1 px-2.5 py-2 flex flex-col justify-center gap-1.5`}>
          <span className={MK}>이익 변화 원인</span>
          {d.costs.map((c) => (
            <div key={c.l} className="flex items-center gap-1.5 text-[10px]">
              <span className="w-11 text-right text-[#A3A5AD]">{c.l}</span>
              <span className="h-[9px] rounded-sm" style={{ width: c.w, background: c.bg }} />
              <span className="font-bold">{c.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Quant({ d, accent }) {
  return (
    <div className="h-full grid grid-cols-[1fr_1.1fr] gap-2">
      <div className={`${TILE} px-2.5 py-2 flex flex-col gap-[7px]`}>
        <span className={MK}>전략 · 팩터와 가중치</span>
        {d.factors.map(([n, w, on]) => (
          <div key={n} className="flex items-center gap-2 text-[10.5px]">
            <span className={`w-5 h-3 rounded-md p-px box-border flex ${on ? 'justify-end' : 'justify-start'}`} style={{ background: on ? accent : '#2E2F36' }}>
              <span className="w-2.5 h-2.5 rounded-full bg-white" />
            </span>
            <span className="flex-1 font-semibold" style={{ color: on ? '#F2F2F0' : '#6E7078' }}>{n}</span>
            <span className="w-8 text-right font-bold" style={{ color: on ? '#F2F2F0' : '#6E7078' }}>{on ? `${w}%` : '—'}</span>
          </div>
        ))}
        <span className={`${MK} mt-auto`}>포트폴리오 · S&amp;P 500</span>
        <div className="flex flex-wrap gap-1">
          {d.chips.map((c) => <span key={c} className="px-1.5 py-0.5 rounded-[3px] bg-[#1E1F24] text-[9.5px] font-bold">{c}</span>)}
        </div>
      </div>
      <div className={`${TILE} px-2.5 py-2 flex flex-col gap-1.5`}>
        <span className={MK}>이번 달 점수 순위</span>
        {d.scores.map(([sym, v], i) => (
          <div key={sym} className="flex flex-col gap-1.5">
            {i === 3 && (
              <span className="flex items-center gap-1.5 text-[8.5px] text-[#8A8C95]">
                <span className="flex-1 border-t border-dashed border-[#3A3B42]" />매수 기준선<span className="flex-1 border-t border-dashed border-[#3A3B42]" />
              </span>
            )}
            <div className="flex items-center gap-2 text-[10.5px]">
              <span className="w-2.5 text-[#8A8C95]">{i + 1}</span>
              <span className="w-10 font-bold">{sym}</span>
              <span className="flex-1 h-[5px] bg-[#1E1F24]"><span className="block h-[5px]" style={{ width: `${Math.round(v * 100)}%`, background: i < 3 ? accent : '#4A4B52' }} /></span>
              <span className="w-7 text-right font-bold">{v.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Backtest({ d, accent }) {
  return (
    <div className="h-full flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-1.5">
        {d.kpis.map(([l, v, c, s]) => (
          <div key={l} className={`${TILE} px-2 py-[7px] flex flex-col gap-px`}>
            <span className="text-[9.5px] text-[#8A8C95]">{l}</span>
            <span className="text-[15px] font-bold" style={{ color: c }}>{v}</span>
            <span className="text-[9px] text-[#6E7078]">{s}</span>
          </div>
        ))}
      </div>
      <div className={`${TILE} flex-1 min-h-0 px-2.5 py-2 flex flex-col gap-1`}>
        <span className="flex items-center gap-3 text-[10px] text-[#A3A5AD]">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5" style={{ background: accent }} />전략 <b className="text-[#F2F2F0]">+321%</b></span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#6E7078]" />S&amp;P 500 <b className="text-[#F2F2F0]">+198%</b></span>
          <span className={`${MK} ml-auto`}>2016.01 – 2026.10 · 비용 10bp</span>
        </span>
        <svg viewBox="0 0 300 120" preserveAspectRatio="none" className="flex-1 w-full min-h-0 block" aria-hidden="true">
          <line x1="0" y1={d.zero} x2="300" y2={d.zero} stroke="#26272D" vectorEffect="non-scaling-stroke" />
          <polygon points={`0,${d.zero} ${d.eqS} 300,${d.zero}`} fill={accent} opacity="0.10" />
          <polyline points={d.eqB} fill="none" stroke="#6E7078" strokeWidth="1.3" vectorEffect="non-scaling-stroke" />
          <polyline points={d.eqS} fill="none" stroke={accent} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <svg viewBox="0 0 300 30" preserveAspectRatio="none" className="h-[30px] w-full block border-t border-[#1A1B1F]" aria-hidden="true">
          <polygon points={d.ddArea} fill="#3182F6" opacity="0.35" />
        </svg>
      </div>
    </div>
  );
}

const VIEWS = [Overview, Dashboard, Equity, Quant, Backtest];

export default function LoginShowcase({ accent, seconds = 6 }) {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [slide, setSlide] = useState(0);
  const [playing, setPlaying] = useState(!reduce);
  const [round, setRound] = useState(0);   // 같은 장을 다시 고르면 진행 막대를 처음부터
  const timer = useRef(null);
  const d = useData(accent);
  const N = SLIDES.length;

  useEffect(() => {
    if (!playing) return undefined;
    timer.current = setTimeout(() => setSlide((s) => (s + 1) % N), seconds * 1000);
    return () => clearTimeout(timer.current);
  }, [playing, slide, round, seconds, N]);

  const go = (i) => { setSlide((i + N) % N); setRound((r) => r + 1); };
  const cur = SLIDES[slide];
  const View = VIEWS[slide];

  return (
    <section aria-roledescription="carousel" aria-label="MarketPulse 소개" className="w-full max-w-[640px] flex flex-col gap-[18px]">
      <style>{'@keyframes mpfill{from{width:0}to{width:100%}}@media (prefers-reduced-motion: reduce){.mp-fill{animation:none !important}}'}</style>
      <div aria-live="polite" className="flex flex-col gap-3 min-h-[148px]">
        <span className="text-[11px] font-semibold tracking-[0.22em]" style={{ color: accent }}>
          {String(slide + 1).padStart(2, '0')} / {String(N).padStart(2, '0')} · {cur.tag}
        </span>
        <h1 className="m-0 text-[38px] leading-[1.22] font-bold tracking-[-1px]">{cur.title}</h1>
        <p className="m-0 text-[15px] leading-[1.65] text-[#A3A5AD] max-w-[560px]">{cur.desc}</p>
      </div>

      <div role="img" aria-label={cur.aria} className="h-[340px] border border-[#1F2025] rounded-md bg-[#0C0C0E] overflow-hidden flex flex-col">
        <div className="h-[26px] flex-shrink-0 flex items-center gap-2 px-2.5 border-b border-[#1A1B1F] bg-[#0E0F12]">
          <span className="w-[9px] h-[9px]" style={{ background: accent }} />
          <span className="text-[9.5px] font-semibold text-[#8A8C95]">{cur.path}</span>
          <span className={`${MK} ml-auto`}>{cur.tag}</span>
        </div>
        <div className="flex-1 min-h-0 flex">
          <div className="w-7 flex-shrink-0 border-r border-[#1A1B1F] flex flex-col items-center gap-[9px] pt-2.5">
            {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="w-3 h-3 rounded-[3px]" style={{ background: i === cur.rail ? accent : '#1E1F24' }} />)}
          </div>
          <div className="flex-1 min-w-0 p-2.5 box-border"><View d={d} accent={accent} /></div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button type="button" className="mp-nav" onClick={() => go(slide - 1)} aria-label="이전 화면"><ChevronLeft size={16} aria-hidden="true" /></button>
        <div role="tablist" aria-label="소개 화면 선택" className="flex-1 flex gap-1.5">
          {SLIDES.map((s, i) => {
            const on = i === slide;
            return (
              <button key={s.tag} type="button" role="tab" aria-selected={on} aria-label={`${i + 1}. ${s.title}`} title={`${i + 1}. ${s.title}`}
                onClick={() => go(i)} className="flex-1 h-7 bg-transparent p-0 cursor-pointer flex items-center">
                <span className="relative block w-full h-[3px] bg-[#26272D] overflow-hidden">
                  <span
                    key={on ? `${round}-${slide}` : i}
                    className="mp-fill absolute left-0 top-0 bottom-0"
                    style={{
                      background: accent,
                      width: i < slide || (on && !playing) ? '100%' : '0',
                      animation: on && playing ? `mpfill ${seconds}s linear forwards` : 'none',
                    }}
                  />
                </span>
              </button>
            );
          })}
        </div>
        <button type="button" className="mp-nav" onClick={() => go(slide + 1)} aria-label="다음 화면"><ChevronRight size={16} aria-hidden="true" /></button>
        <button type="button" className="mp-nav" onClick={() => setPlaying((p) => !p)} aria-label={playing ? '자동 넘김 멈추기' : '자동 넘김 켜기'} title={playing ? '자동 넘김 멈추기' : '자동 넘김 켜기'}>
          {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
        </button>
      </div>
    </section>
  );
}
