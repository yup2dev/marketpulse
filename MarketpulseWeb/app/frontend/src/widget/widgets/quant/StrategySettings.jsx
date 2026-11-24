/**
 * StrategySettings — 퀀트 '전략 설정' 탭 (시안 QuantStrategy.dc.html).
 *
 * 전략 = 규칙 전체 — 대상 종목 · 점수 · 매크로 조건 · 보유 수 · 리밸런싱.
 *   왼쪽  전략 목록 — 기본 제공(잠김) · 내 전략, 새 전략
 *   오른쪽 편집 — 이름 + 탭 네 개. 탭 이름 아래에 지금 값을 요약해 두어 탭을 열지 않아도 전략 전체가 보인다.
 *          종목   S&P 500 전체 또는 내 포트폴리오 묶음
 *          점수   가격 팩터 · ML 점수를 켜고 가중치로 섞는다 (IC · ICIR · 연 롱숏 · AUC 를 근거로)
 *                 또는 점수 없이 대상 전부 보유(묶음 필요)
 *          매크로 OverlayEditor — 켜진 달만 보유, 꺼진 달은 현금
 *          운용   보유 수 · 리밸런싱
 *          기본 제공은 읽기 전용 — 복제해서 내 전략으로 고친다
 * 저장하면 화면 변수 strategy 를 그 전략으로 — 메인 · 백테스트가 그 전략으로 열린다.
 * 종목 묶음(무엇을 얼마나)은 포트폴리오 설정 탭에서 만든다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Copy, Lock, Plus, Trash2 } from 'lucide-react';
import { apiClient, API_BASE, confirmDialog, notify } from '../../../common';
import WidgetCard from '../../../common/widget/WidgetCard';
import { setShared, useShared } from '../../engine/shared';
import { Switch } from '../../engine/views/parts';
import {
  BTN_DANGER, BTN_GHOST, BTN_PRIMARY, FIELD, KindTag, kindOf, LBL, ListItem, PANEL, Seg, strategyHead, verdict,
} from './quantShared';
import OverlayEditor from './OverlayEditor';

const KINDS = [{ id: 'factor', label: '점수로 고르기' }, { id: 'none', label: '대상 전부 보유' }];
const KIND_NOTE = {
  factor: '켜진 팩터 · ML 점수의 z-점수를 가중합해 상위 종목을 골라요',
  none: '점수 없이 대상 종목을 전부 보유해요 (포트폴리오의 비중 방식대로)',
};
const TABS = [
  { id: 'universe', label: '종목' },
  { id: 'score', label: '점수' },
  { id: 'macro', label: '매크로' },
  { id: 'run', label: '운용' },
];
const ML_PREFIX = 'ml_';

/** 묶음을 고를 때 보유 수 — 묶음보다 적어야 줄 세우는 뜻이 있다 (최소 5, 절반 안팎) */
function fitTopN(topN, size, min = 5) {
  if (topN < size) return topN;
  return Math.max(Math.min(min, size), Math.min(size, Math.round(size / 2)));
}
const REBALANCE = [{ id: 'M', label: '월간' }, { id: 'Q', label: '분기' }];
const pct = (v, d = 1) => (v == null ? '—' : `${v > 0 ? '+' : ''}${Number(v).toFixed(d)}%`);

/** 서버 행 → 편집 모양 (가중치는 합 100 의 %).
 *  ML 전략(score_kind 'ml')은 그 모델 점수 하나만 켠 조합으로 연다 — 순위가 같아 결과도 같다 */
function toDraft(s) {
  const facs = s.score_kind === 'ml' ? [{ factor_id: `${ML_PREFIX}${s.model || 'stack'}`, weight: 1 }] : s.factors;
  const total = facs.reduce((a, f) => a + Number(f.weight || 0), 0) || 1;
  return {
    id: s.strategy_id, builtin: s.builtin, name: s.name, description: s.description || '',
    score_kind: s.score_kind === 'none' ? 'none' : 'factor', top_n: s.top_n, rebalance: s.rebalance,
    basket_id: s.basket_id || '', overlay: s.overlay || null,
    w: Object.fromEntries(facs.map((f) => [f.factor_id, Math.round((Number(f.weight) / total) * 100)])),
  };
}

/** 편집 모양 → 서버 본문 (가중치는 비율만 뜻이 있다 — 서버 범위 0~10 에 맞춰 합 10 으로) */
function toBody(d) {
  const ids = Object.keys(d.w);
  const sum = ids.reduce((a, k) => a + (Number(d.w[k]) || 0), 0);
  return {
    name: d.name.trim() || '이름 없는 전략', description: d.description || null,
    score_kind: d.score_kind, model: null,
    basket_id: d.basket_id || null, overlay: d.overlay || null,
    factors: d.score_kind !== 'factor' ? [] : ids
      .filter((k) => Number(d.w[k]) > 0)
      .map((k) => ({ factor_id: k, weight: sum ? Math.round(((Number(d.w[k]) || 0) / sum) * 10000) / 1000 : 0 })),
    top_n: d.top_n, rebalance: d.rebalance,
  };
}

export default function StrategySettings({ onRemove }) {
  const navigate = useNavigate();
  const shared = useShared();
  const universe = shared.universe || 'sp500';
  const [list, setList] = useState(null);
  const [catalog, setCatalog] = useState({});
  const [stats, setStats] = useState({ factors: {}, models: {}, meta: {} });
  const [sel, setSel] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');
  const [baskets, setBaskets] = useState([]);   // 대상 종목 묶음 = 내 포트폴리오
  const [tab, setTab] = useState('score');

  useEffect(() => {
    apiClient.get(`${API_BASE}/quant-portfolios`).then((r) => setBaskets(r.results || [])).catch(() => setBaskets([]));
  }, []);

  const load = useCallback(async () => {
    const r = await apiClient.get(`${API_BASE}/strategies`);
    setList(r.results || []);
    setCatalog(r.metadata || {});
    return r.results || [];
  }, []);

  useEffect(() => {
    load().catch(() => setList([]));
  }, [load]);

  // 근거 수치 — 배치가 적재한 팩터 · 모델 검증값
  useEffect(() => {
    const q = `universe=${encodeURIComponent(universe)}`;
    Promise.all([
      apiClient.get(`${API_BASE}/quant/factors?${q}`).catch(() => null),
      apiClient.get(`${API_BASE}/quant/models?${q}`).catch(() => null),
    ]).then(([f, m]) => setStats({
      factors: Object.fromEntries((f?.results || []).filter((x) => !x.composite).map((x) => [x.id, x])),
      models: Object.fromEntries((m?.results || []).map((x) => [x.id, x])),
      meta: f?.metadata || {},
    }));
  }, [universe]);

  // 처음 고를 전략 — 화면 변수(메인 · 백테스트에서 고른 것) → 내 전략 첫째 → 첫 전략
  useEffect(() => {
    if (!list?.length || (sel && list.some((s) => s.strategy_id === sel))) return;
    const start = list.find((s) => s.strategy_id === shared.strategy) || list.find((s) => !s.builtin) || list[0];
    setSel(start.strategy_id);
    setDraft(null);
  }, [list, sel, shared.strategy]);

  const base = list?.find((s) => s.strategy_id === sel);
  const cur = useMemo(() => draft || (base ? toDraft(base) : null), [draft, base]);
  const ro = !!cur?.builtin;
  const dirty = !!draft;
  const upd = (patch) => { setDraft({ ...cur, ...patch }); setFlash(''); };

  const pick = async (id) => {
    if (id === sel) return;
    if (dirty && !(await confirmDialog('저장하지 않은 변경이 있어요. 버리고 다른 전략을 열까요?'))) return;
    setSel(id); setDraft(null); setFlash('');
  };

  const run = async (fn, done) => {
    setBusy(true);
    try {
      const res = await fn();
      const rows = await load();
      const id = res?.results?.[0]?.strategy_id;
      if (id) {
        setSel(id);
        setShared('strategy', id);
        setShared('bt_rev', String(Date.now()));   // 메인 · 백테스트 위젯이 다시 부르게
      } else {
        const next = rows.find((s) => !s.builtin) || rows[0];
        setSel(next?.strategy_id || null);
        if (next) setShared('strategy', next.strategy_id);
      }
      setDraft(null);
      setFlash(done);
    } catch (e) {
      notify.fail(e, '처리하지 못했어요');
    } finally {
      setBusy(false);
    }
  };

  const save = () => run(() => apiClient.put(`${API_BASE}/strategies/${cur.id}`, toBody(cur)), '저장했어요 · 메인 · 백테스트에 반영돼요');
  const dup = () => run(() => apiClient.post(`${API_BASE}/strategies`, { ...toBody(cur), name: `${cur.name} 사본` }), '복제했어요 · 이제 고칠 수 있어요');
  const del = async () => {
    if (ro || !(await confirmDialog(`'${cur.name}' 전략을 지울까요?`))) return;
    run(() => apiClient.del(`${API_BASE}/strategies/${cur.id}`), '삭제했어요');
  };
  const addNew = () => run(() => apiClient.post(`${API_BASE}/strategies`, {
    name: '새 전략', score_kind: 'factor', factors: [{ factor_id: catalog.factors?.[0]?.id || 'mom_12_1', weight: 1 }],
    top_n: 30, rebalance: 'M',
  }), '새 전략을 만들었어요');

  const open = (path) => {
    if (cur) setShared('strategy', cur.id);
    setShared('bt_rev', String(Date.now()));
    navigate(path);
  };

  const factors = catalog.factors || [];
  const priceFactors = factors.filter((f) => f.group !== 'ml');
  const mlSignals = factors.filter((f) => f.group === 'ml');
  const onIds = cur ? factors.filter((f) => cur.w[f.id] != null).map((f) => f.id) : [];
  const onMl = onIds.filter((k) => k.startsWith(ML_PREFIX)).length;
  const sum = onIds.reduce((a, k) => a + (Number(cur.w[k]) || 0), 0);
  const isFactor = cur?.score_kind === 'factor';
  const holdAll = cur?.score_kind === 'none';
  const panelMlStart = catalog.panel?.ml_start ? String(catalog.panel.ml_start).slice(0, 7) : '';
  const noFactor = isFactor && onIds.length === 0;
  const basket = baskets.find((b) => b.portfolio_id === cur?.basket_id);
  const needBasket = holdAll && !cur?.basket_id;
  const ruleCount = cur?.overlay?.rules?.length || 0;
  const minN = catalog.top_n?.[0] || 5;
  const maxN = Math.min(catalog.top_n?.[1] || 100, basket ? Math.max(minN, basket.items.length) : Infinity);
  const pickN = basket ? Math.min(cur?.top_n || 0, basket.items.length) : cur?.top_n;
  const holdsAllOfBasket = !!basket && isFactor && cur.top_n >= basket.items.length;
  const tabSub = cur ? {
    universe: basket ? `${basket.name} · ${basket.items.length}종목` : 'S&P 500 전체',
    score: holdAll ? '전부 보유' : [onIds.length - onMl && `팩터 ${onIds.length - onMl}`, onMl && `ML ${onMl}`].filter(Boolean).join(' · ') || '없음',
    macro: ruleCount ? `조건 ${ruleCount}개` : '없음 · 늘 보유',
    run: `${holdAll ? '전부 보유' : basket ? `${basket.items.length}종목 중 상위 ${pickN}` : `상위 ${cur.top_n}종목`} · ${cur.rebalance === 'Q' ? '분기' : '월간'}`,
  } : {};
  const tabWarn = { universe: needBasket, score: noFactor || needBasket, run: holdsAllOfBasket };
  const headOf = (s) => strategyHead(s, catalog, baskets);
  const builtins = (list || []).filter((s) => s.builtin);
  const mine = (list || []).filter((s) => !s.builtin);
  const shownName = (s) => (s.strategy_id === sel && draft ? draft.name : s.name);
  const shownHead = (s) => headOf(s.strategy_id === sel && draft ? { ...toBody(draft) } : s);
  const period = stats.meta.start && stats.meta.end ? `${String(stats.meta.start).slice(0, 7)}–${String(stats.meta.end).slice(0, 7)}` : '';

  return (
    <WidgetCard
      title="전략 설정"
      source="db"
      sourceNote="전략 = 대상 종목 · 점수 · 매크로 조건 · 리밸런싱 · 종목 묶음은 포트폴리오 설정에서 만들어요"
      onRemove={onRemove}
      loading={!list}
    >
      <div className="h-full min-h-0 grid grid-cols-1 md:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] gap-2 p-2">

        <section aria-label="전략 목록" className={PANEL}>
          <div className="flex items-center gap-2 h-12 px-3 flex-shrink-0 border-b border-[var(--mp-tag)]">
            <span className="text-[13px] font-bold">전략</span>
            <span className="text-[11px] text-[var(--mp-muted)]">{list?.length ?? ''}</span>
            <button type="button" onClick={addNew} disabled={busy} className={`${BTN_GHOST} ml-auto !h-[30px] !px-2.5 !text-xs`}>
              <Plus size={13} aria-hidden="true" />새 전략
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-2 flex flex-col gap-0.5">
            <span className={`${LBL} px-1 py-1.5`}>기본 제공</span>
            {builtins.map((s) => (
              <ListItem
                key={s.strategy_id} on={s.strategy_id === sel} onClick={() => pick(s.strategy_id)}
                title={s.name} sub={headOf(s)}
                right={<><KindTag kind={kindOf(s)} /><Lock size={13} className="text-[var(--mp-muted)]" aria-label="잠김" /></>}
              />
            ))}
            <span className={`${LBL} px-1 pt-3.5 pb-1.5`}>내 전략</span>
            {mine.map((s) => (
              <ListItem
                key={s.strategy_id} on={s.strategy_id === sel} onClick={() => pick(s.strategy_id)}
                title={shownName(s)} sub={shownHead(s)} right={<KindTag kind={kindOf(s)} />}
              />
            ))}
            {!mine.length && <span className="px-1 py-2.5 text-xs text-[var(--mp-muted)]">아직 없어요 · 기본 전략을 복제하거나 새로 만들어요</span>}
          </div>
          <p className="m-0 px-3 py-2.5 text-[11px] text-[var(--mp-muted)] border-t border-[var(--mp-tag)] flex-shrink-0">
            기본 제공 전략은 잠겨 있어요 · 복제하면 내 전략으로 고칠 수 있어요
          </p>
        </section>

        {cur && (
          <section aria-label="전략 편집" className={PANEL}>
            <div className="flex flex-wrap items-end gap-2.5 px-4 py-3 flex-shrink-0 border-b border-[var(--mp-tag)]">
              <label className="flex flex-col gap-1 flex-[1_1_280px] min-w-0">
                <span className={LBL}>이름</span>
                <input
                  className={`${FIELD} font-semibold text-sm`} type="text" value={cur.name} maxLength={100}
                  disabled={ro} onChange={(e) => upd({ name: e.target.value })}
                />
              </label>
              {dirty && <span className="mb-2 h-[22px] px-2 flex items-center rounded-md bg-[#2A2110] text-[#F5B748] text-[10.5px] font-semibold">저장 안 됨</span>}
              {flash && <span role="status" className="mb-2.5 text-xs text-[#3FC27A]">{flash}</span>}
              <span className="flex gap-2">
                <button type="button" className={BTN_GHOST} onClick={dup} disabled={busy}><Copy size={14} aria-hidden="true" />복제</button>
                <button type="button" className={BTN_DANGER} onClick={del} disabled={ro || busy}><Trash2 size={14} aria-hidden="true" />삭제</button>
                <button type="button" className={BTN_PRIMARY} onClick={save} disabled={ro || !dirty || noFactor || needBasket || busy}>저장</button>
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-auto p-4 flex flex-col gap-5">
              {ro && (
                <div className="flex flex-wrap items-center gap-2.5 px-3 py-2.5 rounded-md bg-[#1B2A44] border border-[#2B3A55] text-[13px] text-[#CFE0FF]">
                  <Lock size={15} aria-hidden="true" className="flex-shrink-0" />
                  <span className="flex-1">기본 제공 전략이에요. 고치려면 복제해서 내 전략으로 만들어요.</span>
                  <button type="button" className={`${BTN_PRIMARY} !h-[30px] !text-xs`} onClick={dup} disabled={busy}>복제해서 편집</button>
                </div>
              )}

              <div role="tablist" aria-label="전략 구성" className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {TABS.map((t) => {
                  const on = tab === t.id;
                  return (
                    <button
                      key={t.id} type="button" role="tab" id={`st-tab-${t.id}`} aria-selected={on} aria-controls={`st-panel-${t.id}`}
                      onClick={() => setTab(t.id)}
                      className={`flex flex-col items-start gap-0.5 px-3 py-2 rounded-md border text-left transition-colors ${on ? 'border-[var(--mp-accent)] bg-[rgba(49,130,246,0.08)]' : 'border-[var(--mp-tag)] hover:bg-[var(--mp-raised)]'}`}
                    >
                      <span className={`flex items-center gap-1.5 text-[13px] font-bold ${on ? 'text-[var(--mp-text)]' : 'text-[var(--mp-text-2)]'}`}>
                        {t.label}
                        {tabWarn[t.id] && <span className="w-1.5 h-1.5 rounded-full bg-[#F5A623]" aria-label="확인 필요" />}
                      </span>
                      <span className="w-full text-[11.5px] text-[var(--mp-muted)] truncate">{tabSub[t.id]}</span>
                    </button>
                  );
                })}
              </div>

              <div role="tabpanel" id={`st-panel-${tab}`} aria-labelledby={`st-tab-${tab}`} className="flex flex-col gap-4">
                {tab === 'universe' && (
                  <>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <label htmlFor="st-basket" className={`${LBL} w-24`}>대상 종목</label>
                      <select
                        id="st-basket" value={cur.basket_id || ''} disabled={ro}
                        onChange={(e) => {
                          const b = baskets.find((x) => x.portfolio_id === e.target.value);
                          upd({
                            basket_id: e.target.value,
                            ...(b ? { top_n: fitTopN(cur.top_n, b.items.length) } : { score_kind: 'factor' }),
                          });
                        }}
                        className="h-8 px-2 rounded-md border border-[var(--mp-tile-line)] bg-[var(--mp-raised)] text-[13px] text-[var(--mp-text)] outline-none focus:border-[var(--mp-accent)] [&_option]:bg-[var(--mp-panel)] disabled:text-[var(--mp-muted)]"
                      >
                        <option value="">S&amp;P 500 전체</option>
                        {baskets.map((b) => <option key={b.portfolio_id} value={b.portfolio_id}>{b.name} · {b.items.length}종목</option>)}
                      </select>
                      <span className="text-xs text-[var(--mp-muted)]">
                        {basket ? '이 묶음 종목만 점수로 줄 세워 상위를 고르거나, 전부 보유해요' : '유니버스 전체에서 점수로 골라요'}
                        {' · '}
                        <button type="button" className="underline-offset-2 hover:underline text-[var(--mp-text-2)]" onClick={() => navigate('/quantlib?tab=portfolio')}>
                          묶음 만들기 · 고치기
                        </button>
                      </span>
                    </div>
                    {basket ? (
                      <div className="flex flex-col gap-1.5 px-3 py-2.5 border border-[var(--mp-tag)] rounded-md">
                        <span className="text-[13px] font-bold">{basket.name} — {basket.items.length}종목</span>
                        <span className="flex flex-wrap gap-1">
                          {basket.items.map((i) => (
                            <span key={i.symbol} className="px-1.5 py-0.5 rounded bg-[var(--mp-raised)] text-[11.5px] text-[var(--mp-text-2)]">{i.symbol}</span>
                          ))}
                        </span>
                      </div>
                    ) : (
                      <p className="m-0 text-xs text-[var(--mp-muted)]">S&amp;P 500 현재 구성종목 전체 (생존 편향 주의) — 특정 종목만 쓰려면 포트폴리오 탭에서 묶음을 만들어 고르세요.</p>
                    )}
                    {needBasket && <span className="text-xs text-[#F5A623]">'대상 전부 보유'는 묶음을 골라야 해요</span>}
                  </>
                )}

                {tab === 'score' && (
                  <>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <Seg
                        items={KINDS.map((k) => (basket
                          ? { ...k, label: k.id === 'none' ? `${basket.name} 전부 보유` : `${basket.name} 안에서 점수로 고르기` }
                          : k.id === 'none' ? { ...k, label: '대상 전부 보유 (묶음 필요)' } : k))}
                        value={cur.score_kind}
                        onChange={(k) => { if (k === 'none' && !cur.basket_id) { setTab('universe'); return; } upd({ score_kind: k }); }}
                        disabled={ro} label="점수 방식"
                      />
                      <span className="text-xs text-[var(--mp-muted)]">
                        {basket && isFactor ? `${basket.items.length}종목을 매달 점수로 줄 세워 상위 ${pickN}종목을 골라요` : KIND_NOTE[cur.score_kind]}
                      </span>
                    </div>

                    {holdAll ? (
                      <div className="flex flex-col gap-1 px-3 py-2.5 border border-[var(--mp-tag)] rounded-md text-xs">
                        {basket ? (
                          <>
                            <span className="text-[13px] font-bold">{basket.name} — {basket.items.length}종목 전부 보유</span>
                            <span className="text-[var(--mp-muted)] truncate">{basket.items.map((i) => i.symbol).join(' · ')}</span>
                          </>
                        ) : (
                          <span className="text-[#F5A623]">종목 탭에서 대상 종목 묶음을 골라 주세요</span>
                        )}
                      </div>
                    ) : isFactor && (
                      <div className="flex flex-col border border-[var(--mp-tag)] rounded-md">
                        <div className="flex flex-wrap items-center gap-3 min-h-10 px-3 py-1 border-b border-[var(--mp-tag)]">
                          <span className="text-[13px] font-bold">점수 재료와 가중치</span>
                          <span className="text-[11.5px] text-[var(--mp-muted)]">여러 개를 켜면 z-점수를 가중합해요</span>
                          {period && <span className={`${LBL} ml-auto`}>근거 수치 · S&amp;P 500 전체 · {period} · 월간{basket ? ' (묶음 기준 아님)' : ''}</span>}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[640px] border-collapse">
                            <thead>
                              <tr className="h-[30px] text-[11px] text-[var(--mp-muted)]">
                                <th scope="col" className="w-11 pl-3 text-left font-medium">사용</th>
                                <th scope="col" className="px-2 text-left font-medium">이름</th>
                                <th scope="col" className="w-[168px] px-2 text-left font-medium">가중치</th>
                                <th scope="col" className="w-[196px] px-2 text-right font-medium">근거</th>
                                <th scope="col" className="w-[60px] pr-3 pl-2 text-right font-medium">판정</th>
                              </tr>
                            </thead>
                            {[
                              { id: 'factor', title: '가격 팩터', note: 'IC · ICIR · 연 롱숏', rows: priceFactors },
                              { id: 'ml', title: 'ML 점수', note: `AUC · 검증 샤프 · ${panelMlStart ? `${panelMlStart} 이후만 계산` : '표본 밖 구간만 계산'}`, rows: mlSignals },
                            ].map((g) => g.rows.length > 0 && (
                              <tbody key={g.id}>
                                <tr className="h-8 border-t border-[var(--mp-tag)] bg-[var(--mp-raised)]/40">
                                  <th scope="rowgroup" colSpan={5} className="px-3 text-left text-[11.5px] font-semibold text-[var(--mp-text-2)]">
                                    {g.title}<span className="ml-2 font-normal text-[var(--mp-muted)]">{g.note}</span>
                                  </th>
                                </tr>
                                {g.rows.map((f) => {
                                  const on = cur.w[f.id] != null;
                                  const wv = on ? Number(cur.w[f.id]) || 0 : 0;
                                  const isM = g.id === 'ml';
                                  const st = isM ? stats.models[f.model] : stats.factors[f.id];
                                  const v = isM ? null : verdict(st);
                                  return (
                                    <tr key={f.id} className={`h-[52px] border-t border-[var(--mpc-grid)] ${on ? 'bg-[rgba(49,130,246,0.04)]' : ''}`}>
                                      <td className="pl-3">
                                        <Switch
                                          checked={on} disabled={ro} label={`${f.name} 사용`}
                                          onChange={() => {
                                            const w = { ...cur.w };
                                            if (on) delete w[f.id]; else w[f.id] = 20;
                                            upd({ w });
                                          }}
                                        />
                                      </td>
                                      <td className="px-2">
                                        <span className="flex flex-col gap-0.5">
                                          <span className={`font-semibold ${on ? 'text-[var(--mp-text)]' : 'text-[var(--mp-muted)]'}`}>{f.name}</span>
                                          <span className="text-[11px] text-[var(--mp-muted)]">{isM ? (st?.kind || f.desc) : f.desc}</span>
                                        </span>
                                      </td>
                                      <td className="px-2">
                                        <span className="flex items-center gap-2">
                                          <input
                                            className={`${FIELD} !h-[30px] w-16 !px-1.5 text-right`} type="number" min="0" max="100" step="5"
                                            value={on ? String(wv) : ''} disabled={ro || !on} aria-label={`${f.name} 가중치 (%)`}
                                            onChange={(e) => upd({ w: { ...cur.w, [f.id]: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) } })}
                                          />
                                          <span className="flex-1 h-1 bg-[var(--mp-tag)]">
                                            <span className="block h-1 bg-[var(--mp-accent)]" style={{ width: `${on && sum ? Math.round((wv / sum) * 100) : 0}%` }} />
                                          </span>
                                        </span>
                                      </td>
                                      <td className="px-2 text-right text-[12px] text-[var(--mp-text-2)] tabular-nums whitespace-nowrap">
                                        {isM ? (
                                          st ? <>AUC {st.auc != null ? Number(st.auc).toFixed(3) : '—'} · 샤프 {st.sharpe != null ? Number(st.sharpe).toFixed(2) : '—'}</>
                                            : <span className="text-[var(--mp-muted)]">적재 전</span>
                                        ) : (
                                          <>
                                            {st?.ic != null ? Number(st.ic).toFixed(3) : '—'} · {st?.icir != null ? Number(st.icir).toFixed(2) : '—'} ·{' '}
                                            <span className={`font-semibold ${st?.ls_ann > 0 ? 'text-[var(--mpc-up)]' : st?.ls_ann < 0 ? 'text-[var(--mpc-down)]' : ''}`}>{pct(st?.ls_ann)}</span>
                                          </>
                                        )}
                                      </td>
                                      <td className="pr-3 pl-2 text-right">
                                        {v && <span className={`px-1.5 py-0.5 rounded-md text-[10.5px] font-bold ${v.cls}`}>{v.label}</span>}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            ))}
                          </table>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 border-t border-[var(--mp-tag)] text-xs">
                          <span className="text-[var(--mp-muted)]">켜진 재료 <span className="text-[var(--mp-text)] font-semibold">{onIds.length}</span></span>
                          <span className="text-[var(--mp-muted)]">가중치 합계 <span className={`font-bold ${noFactor ? 'text-[#F5A623]' : sum === 100 ? 'text-[#3FC27A]' : 'text-[#F5B748]'}`}>{sum}%</span></span>
                          <span className={noFactor ? 'text-[#F5A623]' : sum === 100 ? 'text-[#3FC27A]' : 'text-[#F5B748]'}>
                            {noFactor ? '하나 이상 켜 주세요' : sum === 100 ? '합계가 맞아요' : '저장할 때 비율대로 100%로 맞춰요'}
                          </span>
                          <span className="ml-auto text-[var(--mp-muted)]">IC = 월간 순위 상관 평균 · 판정은 t값 기준</span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {tab === 'macro' && (
                  <div className="p-3.5 border border-[var(--mp-tag)] rounded-md">
                    {ro ? (
                      <span className="text-xs text-[var(--mp-muted)]">
                        매크로 조건 — {ruleCount ? `${ruleCount}개` : '없음 (늘 보유)'} · 복제하면 고칠 수 있어요
                      </span>
                    ) : (
                      <OverlayEditor
                        value={cur.overlay} onChange={(o) => upd({ overlay: o })}
                        catalog={catalog} loaded={catalog.panel?.macro || []}
                      />
                    )}
                  </div>
                )}

                {tab === 'run' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className={`${LBL} w-24`}>보유 종목</span>
                      {holdAll ? (
                        <span className="text-xs text-[var(--mp-muted)]">대상 묶음을 전부 보유해요</span>
                      ) : (
                        <label className="flex items-center gap-1.5 text-xs text-[var(--mp-muted)]">
                          {basket ? `${basket.name} ${basket.items.length}종목 중 점수 상위` : '점수 상위'}
                          <input
                            className={`${FIELD} !h-8 w-16 !px-1.5 text-right`} type="number" min={minN} max={maxN}
                            value={String(cur.top_n)} disabled={ro} aria-label="보유 종목 수"
                            onChange={(e) => upd({ top_n: Math.max(minN, Math.min(maxN, Math.round(Number(e.target.value) || minN))) })}
                          />
                          종목 · 같은 비중
                        </label>
                      )}
                      {holdsAllOfBasket && (
                        <span className="text-xs text-[#F5B748]">묶음 종목 수 이상이라 사실상 전부 보유예요 — 줄 세우려면 {basket.items.length}보다 작게</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className={`${LBL} w-24`}>리밸런싱</span>
                      <Seg items={REBALANCE} value={cur.rebalance} onChange={(r) => upd({ rebalance: r })} disabled={ro} label="리밸런싱" size="sm" />
                      <span className="text-xs text-[var(--mp-muted)]">매달(또는 분기) 말 점수로 다시 골라요</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 flex-shrink-0 border-t border-[var(--mp-tag)] bg-[var(--mp-raised)]/40">
              <span className={LBL}>요약</span>
              <span className="text-[13px] font-semibold">{headOf(toBody(cur))}</span>
              <span className="ml-auto flex gap-2">
                <button type="button" className={BTN_GHOST} onClick={() => open('/quantlib?tab=factors')}>메인에서 보기</button>
                <button type="button" className={BTN_PRIMARY} onClick={() => open('/backtest')}>
                  백테스트에서 보기<ArrowRight size={14} aria-hidden="true" />
                </button>
              </span>
            </div>
          </section>
        )}
      </div>
    </WidgetCard>
  );
}
