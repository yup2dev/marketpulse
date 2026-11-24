/**
 * QuantWorkflow — 퀀트 메인(대시보드) 머리줄 (시안 QuantMain.dc.html):
 *   유니버스 · 전략 · 점수 종류와 요약 · 단계 ①②③ · 기간 · 전략 편집 · 백테스트에서 보기
 *
 *   유니버스   화면 변수 universe — 퀀트 위젯이 같이 따른다
 *   전략       화면 변수 strategy — /backtest 머리줄(StrategyPicker)과 같은 변수라 한쪽에서 고르면 다른 쪽도 그 전략.
 *             메인 위젯(팩터 · 팩터 성과 · ML 모델 · 이번 달 순위)이 그 전략 점수로 바뀐다 (routes/quant.py)
 *   단계       화면 변수 quant_step — 그 단계의 위젯(옵션 highlight)이 테두리로 강조된다
 *   기준월     화면 변수 quant_asof (월말 YYYY-MM-DD, 비우면 최신 — 전략 점수가 있는 마지막 달) — 순위 위젯이 그달 점수로 줄 세우고,
 *             지난달이면 실제 다음 달 수익률을 같이 보여 준다 (그때 이 순위대로 샀으면 어땠는지)
 *   전략 편집  전략 설정 탭(?tab=strategy) — 메인의 팩터 스위치는 읽기 전용이다
 *
 * 전략 설정 · 포트폴리오 설정 탭에서는 그리지 않는다 (그 탭은 화면 안에 자기 머리줄이 있다).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { apiClient, API_BASE } from '../../../common';
import { setShared, useShared } from '../../engine/shared';
import { KindTag, kindOf, monthEnds, strategyHead } from './quantShared';

// 배치(build_quant.py)가 적재하는 유니버스 — 늘리면 여기와 위젯의 universe 선택지를 같이 늘린다
const UNIVERSES = [{ id: 'sp500', name: 'S&P 500' }];
export const DASHBOARD_TAB = 'factors';

const STEPS = [
  { id: 'factor', label: '팩터' },
  { id: 'ml', label: 'ML 모델' },
  { id: 'rank', label: '종목 순위' },
];

const CTL = 'flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-[var(--mp-tile-line)] bg-[var(--mp-raised)] text-xs text-[var(--mp-muted)]';
const SELECT = 'bg-transparent text-[var(--mp-text)] font-bold outline-none cursor-pointer [&_option]:bg-[var(--mp-panel)] [&_optgroup]:bg-[var(--mp-panel)]';
const ym = (d) => (d ? String(d).slice(0, 7).replace('-', '.') : '');

export default function QuantWorkflow() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tab = params.get('tab') || DASHBOARD_TAB;
  const shared = useShared();
  const universe = shared.universe || UNIVERSES[0].id;
  const step = shared.quant_step || 'factor';
  const [list, setList] = useState(null);
  const [catalog, setCatalog] = useState({});
  const [period, setPeriod] = useState('');

  useEffect(() => {
    apiClient.get(`${API_BASE}/strategies`)
      .then((r) => { setList(r.results || []); setCatalog(r.metadata || {}); })
      .catch(() => setList([]));
  }, [tab]);   // 전략 설정 탭에서 고치고 돌아오면 다시 읽는다

  const fallback = catalog.default || list?.[0]?.strategy_id || '';
  const valid = list?.some((s) => s.strategy_id === shared.strategy);
  const value = valid ? shared.strategy : fallback;
  const selected = list?.find((s) => s.strategy_id === value);

  // 화면 변수가 비었거나 메인에서 쓸 수 없는 값(포트폴리오 등)이면 기본 전략으로 — 위젯이 같은 전략을 그리게
  useEffect(() => {
    if (list && !valid && fallback) setShared('strategy', fallback);
  }, [list, valid, fallback]);

  // 기간 — 팩터 검증 기간 (적재 전이면 비운다)
  useEffect(() => {
    let alive = true;
    apiClient.get(`${API_BASE}/quant/factors?universe=${encodeURIComponent(universe)}`)
      .then((f) => {
        const md = f?.metadata || {};
        if (alive) setPeriod(md.start && md.end ? `${ym(md.start)}–${ym(md.end)}` : '');
      })
      .catch(() => alive && setPeriod(''));
    return () => { alive = false; };
  }, [universe]);

  const head = useMemo(() => strategyHead(selected, catalog), [selected, catalog]);

  // 기준월 — 패널 첫 달 ~ 마지막 달(이번 달). 목록 밖 값(패널이 바뀜)은 이번 달로
  const months = useMemo(() => monthEnds(catalog.panel?.start, catalog.panel?.last), [catalog]);
  const asOf = months.slice(1).includes(shared.quant_asof) ? shared.quant_asof : '';
  useEffect(() => {
    if (months.length && shared.quant_asof && !asOf) setShared('quant_asof', '');
  }, [months, shared.quant_asof, asOf]);

  if (tab !== DASHBOARD_TAB) return null;
  const builtin = (list || []).filter((s) => s.builtin);
  const mine = (list || []).filter((s) => !s.builtin);

  return (
    <div className="flex-1 flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
      <label className={CTL}>
        유니버스
        <select value={universe} onChange={(e) => setShared('universe', e.target.value)} className={SELECT}>
          {UNIVERSES.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </label>
      <label className={`${CTL}`}>
        전략
        <select
          aria-label="전략 선택"
          value={value}
          onChange={(e) => { setShared('strategy', e.target.value); setShared('bt_rev', String(Date.now())); }}
          className={`${SELECT} max-w-[220px]`}
        >
          {!list?.length && <option value="">불러오는 중…</option>}
          {builtin.length > 0 && (
            <optgroup label="기본 제공">
              {builtin.map((s) => <option key={s.strategy_id} value={s.strategy_id}>{s.name}</option>)}
            </optgroup>
          )}
          {mine.length > 0 && (
            <optgroup label="내 전략">
              {mine.map((s) => <option key={s.strategy_id} value={s.strategy_id}>{s.name}</option>)}
            </optgroup>
          )}
        </select>
      </label>
      {selected && (
        <span className="flex items-center gap-2 min-w-0">
          <span title={head}><KindTag kind={kindOf(selected)} /></span>
          <span className="hidden 2xl:inline text-xs font-medium text-[var(--mp-text-2)] truncate max-w-[220px]" title={head}>{head}</span>
        </span>
      )}

      <ol aria-label="워크플로 단계" className="flex flex-wrap items-center gap-0.5 m-0 ml-1 p-0 list-none">
        {STEPS.map((s, i) => {
          const on = s.id === step;
          return (
            <li key={s.id} className="flex items-center gap-0.5">
              <button
                type="button"
                aria-pressed={on}
                onClick={() => setShared('quant_step', s.id)}
                className={`flex items-center gap-2 h-8 pl-1.5 pr-2.5 rounded-md transition-colors ${on ? 'bg-[var(--mp-raised)] text-[var(--mp-text)]' : 'text-[var(--mp-muted)] hover:text-[var(--mp-text)]'}`}
              >
                <span className={`w-5 h-5 flex items-center justify-center text-[11px] font-semibold ${on ? 'bg-[var(--mp-accent)] text-white' : 'bg-[var(--mp-chip-on)] text-[var(--mp-text-2)]'}`}>{i + 1}</span>
                <span className="text-xs font-semibold whitespace-nowrap">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <ChevronRight size={12} className="text-[var(--mp-grip)]" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      <span className="ml-auto flex items-center gap-2">
        {months.length > 0 && (
          <label className="flex items-center gap-1 h-8 px-2 rounded-md border border-[var(--mp-tile-line)] text-[11px] text-[var(--mp-muted)]" title="이 달의 점수로 순위를 매겨요 — 지난달이면 실제 다음 달 수익률도 보여요">
            순위 기준
            <select aria-label="순위 기준월" value={asOf} onChange={(e) => setShared('quant_asof', e.target.value)} className={`${SELECT} text-xs`}>
              <option value="">최신</option>
              {months.slice(1).map((d) => <option key={d} value={d}>{ym(d)}</option>)}
            </select>
          </label>
        )}
        {period && <span className="hidden 2xl:inline text-[11px] text-[var(--mp-faint)] whitespace-nowrap" title="팩터 검증 기간">기간 {period}</span>}
        <button
          type="button"
          onClick={() => navigate(`/quantlib?tab=strategy`)}
          className="h-8 px-3 rounded-md border border-[var(--mp-tile-line)] text-xs font-semibold text-[var(--mp-text)] hover:bg-[var(--mp-raised)] whitespace-nowrap"
        >
          전략 편집
        </button>
        <button
          type="button"
          disabled={!value}
          onClick={() => { setShared('strategy', value); setShared('bt_rev', String(Date.now())); navigate('/backtest'); }}
          title={selected ? `${selected.name} 을(를) 백테스트 화면에서 열어요` : undefined}
          className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[var(--mp-accent)] text-white text-xs font-bold whitespace-nowrap hover:brightness-110 disabled:opacity-50"
        >
          백테스트에서 보기
          <ArrowRight size={13} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}
