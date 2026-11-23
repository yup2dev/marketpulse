/**
 * StrategySettings — 퀀트 '전략 설정' 탭 (시안 QuantStrategy.dc.html).
 *
 * 전략 = 규칙 전체 — 대상 종목 · 점수 · 매크로 조건 · 보유 수 · 리밸런싱.
 *   왼쪽  전략 목록 — 기본 제공(잠김) · 내 전략, 새 전략
 *   오른쪽 편집 — 이름 · 대상 종목(S&P 500 전체 또는 내 포트폴리오 묶음) · 점수 종류
 *          (팩터와 가중치 — IC · ICIR · 연 롱숏 · 판정을 근거로 / ML 모델 카드 / 대상 전부 보유)
 *          · 매크로 조건(OverlayEditor — 켜진 달만 보유, 꺼진 달은 현금) · 보유 수 · 리밸런싱
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
  BTN_DANGER, BTN_GHOST, BTN_PRIMARY, FIELD, KindTag, LBL, ListItem, PANEL, Seg, strategyHead, verdict,
} from './quantShared';
import OverlayEditor from './OverlayEditor';

const KINDS = [{ id: 'factor', label: '팩터 조합' }, { id: 'ml', label: 'ML 모델' }, { id: 'none', label: '대상 전부 보유' }];
const KIND_NOTE = {
  factor: '켜진 팩터의 z-점수를 가중합해 점수를 만들어요',
  ml: '학습된 모델의 확률을 그대로 점수로 써요',
  none: '점수 없이 대상 종목을 전부 보유해요 (포트폴리오의 비중 방식대로)',
};
const REBALANCE = [{ id: 'M', label: '월간' }, { id: 'Q', label: '분기' }];
const pct = (v, d = 1) => (v == null ? '—' : `${v > 0 ? '+' : ''}${Number(v).toFixed(d)}%`);

/** 서버 행 → 편집 모양 (가중치는 합 100 의 %) */
function toDraft(s) {
  const total = s.factors.reduce((a, f) => a + Number(f.weight || 0), 0) || 1;
  return {
    id: s.strategy_id, builtin: s.builtin, name: s.name, description: s.description || '',
    score_kind: s.score_kind, model: s.model || 'stack', top_n: s.top_n, rebalance: s.rebalance,
    basket_id: s.basket_id || '', overlay: s.overlay || null,
    w: Object.fromEntries(s.factors.map((f) => [f.factor_id, Math.round((Number(f.weight) / total) * 100)])),
  };
}

/** 편집 모양 → 서버 본문 (가중치는 비율만 뜻이 있다 — 서버 범위 0~10 에 맞춰 합 10 으로) */
function toBody(d) {
  const ids = Object.keys(d.w);
  const sum = ids.reduce((a, k) => a + (Number(d.w[k]) || 0), 0);
  return {
    name: d.name.trim() || '이름 없는 전략', description: d.description || null,
    score_kind: d.score_kind, model: d.score_kind === 'ml' ? d.model : null,
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
  const onIds = cur ? factors.filter((f) => cur.w[f.id] != null).map((f) => f.id) : [];
  const sum = onIds.reduce((a, k) => a + (Number(cur.w[k]) || 0), 0);
  const isFactor = cur?.score_kind === 'factor';
  const isMl = cur?.score_kind === 'ml';
  const holdAll = cur?.score_kind === 'none';
  const noFactor = isFactor && onIds.length === 0;
  const basket = baskets.find((b) => b.portfolio_id === cur?.basket_id);
  const needBasket = holdAll && !cur?.basket_id;
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
                right={<><KindTag kind={s.score_kind} /><Lock size={13} className="text-[var(--mp-muted)]" aria-label="잠김" /></>}
              />
            ))}
            <span className={`${LBL} px-1 pt-3.5 pb-1.5`}>내 전략</span>
            {mine.map((s) => (
              <ListItem
                key={s.strategy_id} on={s.strategy_id === sel} onClick={() => pick(s.strategy_id)}
                title={shownName(s)} sub={shownHead(s)} right={<KindTag kind={s.score_kind} />}
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

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label htmlFor="st-basket" className={`${LBL} w-24`}>대상 종목</label>
                <select
                  id="st-basket" value={cur.basket_id || ''} disabled={ro}
                  onChange={(e) => upd({ basket_id: e.target.value, ...(e.target.value ? {} : { score_kind: holdAll ? 'factor' : cur.score_kind }) })}
                  className="h-8 px-2 rounded-md border border-[var(--mp-tile-line)] bg-[var(--mp-raised)] text-[13px] text-[var(--mp-text)] outline-none focus:border-[var(--mp-accent)] [&_option]:bg-[var(--mp-panel)] disabled:text-[var(--mp-muted)]"
                >
                  <option value="">S&amp;P 500 전체</option>
                  {baskets.map((b) => <option key={b.portfolio_id} value={b.portfolio_id}>{b.name} · {b.items.length}종목</option>)}
                </select>
                <span className="text-xs text-[var(--mp-muted)]">
                  {basket ? '이 묶음 안에서만 고르거나 전부 보유해요' : '유니버스 전체에서 점수로 골라요'}
                  {' · '}
                  <button type="button" className="underline-offset-2 hover:underline text-[var(--mp-text-2)]" onClick={() => navigate('/quantlib?tab=portfolio')}>
                    묶음 만들기 · 고치기
                  </button>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className={`${LBL} w-24`}>점수 종류</span>
                <Seg
                  items={KINDS.map((k) => (k.id === 'none' && !cur.basket_id ? { ...k, label: '대상 전부 보유 (묶음 필요)' } : k))}
                  value={cur.score_kind}
                  onChange={(k) => { if (k === 'none' && !cur.basket_id) return; upd({ score_kind: k }); }}
                  disabled={ro} label="점수 종류"
                />
                <span className="text-xs text-[var(--mp-muted)]">{KIND_NOTE[cur.score_kind]}</span>
              </div>

              {holdAll ? (
                <div className="flex flex-col gap-1 px-3 py-2.5 border border-[var(--mp-tag)] rounded-md text-xs">
                  {basket ? (
                    <>
                      <span className="text-[13px] font-bold">{basket.name} — {basket.items.length}종목 전부 보유</span>
                      <span className="text-[var(--mp-muted)] truncate">{basket.items.map((i) => i.symbol).join(' · ')}</span>
                    </>
                  ) : (
                    <span className="text-[#F5A623]">대상 종목 묶음을 골라 주세요</span>
                  )}
                </div>
              ) : isFactor ? (
                <div className="flex flex-col border border-[var(--mp-tag)] rounded-md">
                  <div className="flex flex-wrap items-center gap-3 min-h-10 px-3 py-1 border-b border-[var(--mp-tag)]">
                    <span className="text-[13px] font-bold">팩터와 가중치</span>
                    <span className="text-[11.5px] text-[var(--mp-muted)]">옆의 IC · ICIR · 연 롱숏을 근거로 골라요</span>
                    {period && <span className={`${LBL} ml-auto`}>S&amp;P 500 · {period} · 월간</span>}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse">
                      <thead>
                        <tr className="h-[30px] text-[11px] text-[var(--mp-muted)]">
                          <th scope="col" className="w-11 pl-3 text-left font-medium">사용</th>
                          <th scope="col" className="px-2 text-left font-medium">팩터</th>
                          <th scope="col" className="w-[168px] px-2 text-left font-medium">가중치</th>
                          <th scope="col" className="w-[60px] px-2 text-right font-medium">IC</th>
                          <th scope="col" className="w-[60px] px-2 text-right font-medium">ICIR</th>
                          <th scope="col" className="w-[76px] px-2 text-right font-medium">연 롱숏</th>
                          <th scope="col" className="w-[60px] pr-3 pl-2 text-right font-medium">판정</th>
                        </tr>
                      </thead>
                      <tbody>
                        {factors.map((f) => {
                          const on = cur.w[f.id] != null;
                          const wv = on ? Number(cur.w[f.id]) || 0 : 0;
                          const st = stats.factors[f.id];
                          const v = verdict(st);
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
                                  <span className="text-[11px] text-[var(--mp-muted)]">{f.desc}</span>
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
                              <td className="px-2 text-right text-[var(--mp-text-2)]">{st?.ic != null ? Number(st.ic).toFixed(3) : '—'}</td>
                              <td className="px-2 text-right text-[var(--mp-text-2)]">{st?.icir != null ? Number(st.icir).toFixed(2) : '—'}</td>
                              <td className={`px-2 text-right font-semibold ${st?.ls_ann > 0 ? 'text-[var(--mpc-up)]' : st?.ls_ann < 0 ? 'text-[var(--mpc-down)]' : ''}`}>{pct(st?.ls_ann)}</td>
                              <td className="pr-3 pl-2 text-right">
                                {v && <span className={`px-1.5 py-0.5 rounded-md text-[10.5px] font-bold ${v.cls}`}>{v.label}</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 border-t border-[var(--mp-tag)] text-xs">
                    <span className="text-[var(--mp-muted)]">켜진 팩터 <span className="text-[var(--mp-text)] font-semibold">{onIds.length}</span></span>
                    <span className="text-[var(--mp-muted)]">가중치 합계 <span className={`font-bold ${noFactor ? 'text-[#F5A623]' : sum === 100 ? 'text-[#3FC27A]' : 'text-[#F5B748]'}`}>{sum}%</span></span>
                    <span className={noFactor ? 'text-[#F5A623]' : sum === 100 ? 'text-[#3FC27A]' : 'text-[#F5B748]'}>
                      {noFactor ? '팩터를 하나 이상 켜 주세요' : sum === 100 ? '합계가 맞아요' : '저장할 때 비율대로 100%로 맞춰요'}
                    </span>
                    <span className="ml-auto text-[var(--mp-muted)]">IC = 월간 순위 상관 평균 · 판정은 t값 기준</span>
                  </div>
                </div>
              ) : isMl && (
                <div className="flex flex-col gap-2.5">
                  <span className="flex items-center gap-3">
                    <span className="text-[13px] font-bold">모델</span>
                    <span className="text-[11.5px] text-[var(--mp-muted)]">점수 = 그 모델이 낸 다음 달 초과수익 확률</span>
                  </span>
                  <div role="radiogroup" aria-label="모델" className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
                    {(catalog.models || []).map((m) => {
                      const on = cur.model === m.id;
                      const st = stats.models[m.id];
                      return (
                        <button
                          key={m.id} type="button" role="radio" aria-checked={on} disabled={ro}
                          onClick={() => upd({ model: m.id })}
                          className={`flex flex-col gap-2 p-3 rounded-md bg-[var(--mp-raised)]/60 text-left disabled:cursor-default border ${on ? 'border-[var(--mp-accent)] ring-1 ring-inset ring-[var(--mp-accent)]' : 'border-[var(--mp-tag)]'}`}
                        >
                          <span className="flex items-center gap-2 w-full">
                            <span className={`w-3.5 h-3.5 rounded-full border-[1.5px] flex items-center justify-center ${on ? 'border-[var(--mp-accent)]' : 'border-[var(--mp-grip)]'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-[var(--mp-accent)]' : ''}`} />
                            </span>
                            <span className="text-sm font-bold">{m.name}</span>
                            <span className={`ml-auto text-[11px] ${st ? 'text-[#3FC27A]' : 'text-[var(--mp-muted)]'}`}>{st ? '학습 완료' : '적재 전'}</span>
                          </span>
                          {st?.kind && <span className="text-[11.5px] text-[var(--mp-muted)]">{st.kind}</span>}
                          <span className="flex gap-4 text-xs text-[var(--mp-text-2)]">
                            <span>AUC {st?.auc != null ? Number(st.auc).toFixed(3) : '—'}</span>
                            <span>검증 샤프 {st?.sharpe != null ? Number(st.sharpe).toFixed(2) : '—'}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className={`${LBL} w-24`}>보유 · 리밸런싱</span>
                {!holdAll && (
                  <label className="flex items-center gap-1.5 text-xs text-[var(--mp-muted)]">
                    점수 상위
                    <input
                      className={`${FIELD} !h-8 w-16 !px-1.5 text-right`} type="number" min={catalog.top_n?.[0] || 5} max={catalog.top_n?.[1] || 100}
                      value={String(cur.top_n)} disabled={ro} aria-label="보유 종목 수"
                      onChange={(e) => upd({ top_n: Math.max(catalog.top_n?.[0] || 5, Math.min(catalog.top_n?.[1] || 100, Math.round(Number(e.target.value) || 5))) })}
                    />
                    종목
                  </label>
                )}
                <Seg items={REBALANCE} value={cur.rebalance} onChange={(r) => upd({ rebalance: r })} disabled={ro} label="리밸런싱" size="sm" />
              </div>

              <div className="p-3.5 border border-[var(--mp-tag)] rounded-md">
                {ro ? (
                  <span className="text-xs text-[var(--mp-muted)]">
                    매크로 조건 — {cur.overlay?.rules?.length ? `${cur.overlay.rules.length}개` : '없음 (늘 보유)'} · 복제하면 고칠 수 있어요
                  </span>
                ) : (
                  <OverlayEditor
                    value={cur.overlay} onChange={(o) => upd({ overlay: o })}
                    catalog={catalog} loaded={catalog.panel?.macro || []}
                  />
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
