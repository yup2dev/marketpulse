/**
 * PortfolioSettings — 퀀트 '포트폴리오 설정' 탭 (시안 QuantPortfolio.dc.html).
 *
 * 포트폴리오 = 유니버스를 고르고 그 안에서 종목을 직접 골라 비중 · 리밸런싱을 정한다 (전략과 무관).
 *   왼쪽   내 포트폴리오 목록
 *   가운데 유니버스 · 종목 찾기 · 섹터 칩 · 체크 목록 (유니버스 종목은 /api/quant-portfolios/universe — 패널 마지막 달)
 *   오른쪽 담은 종목 · 비중 방식(동일 · 직접 입력 · 시가총액 · 역변동성) · 현금 · 리밸런싱 · 거래비용
 * 비중 계산은 서버(quant_portfolio_service.target_weights)와 같은 규칙이다.
 * 매크로 조건(OverlayEditor) — 켜진 달만 보유, 꺼진 달은 현금.
 * '이 포트폴리오로 백테스트' = 화면 변수 strategy 를 pf:<id> 로 두고 /backtest — 결과 위젯이 그대로 그린다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Plus, Search, X } from 'lucide-react';
import { apiClient, API_BASE, confirmDialog, notify } from '../../../common';
import WidgetCard from '../../../common/widget/WidgetCard';
import { setShared, useShared } from '../../engine/shared';
import { BTN_GHOST, BTN_PRIMARY, FIELD, LBL, ListItem, PANEL, Seg } from './quantShared';
import OverlayEditor from './OverlayEditor';

const WT = { equal: '동일 비중', manual: '직접 입력', mcap: '시가총액', invvol: '역변동성' };
const WT_NOTE = {
  equal: '담은 종목을 같은 비중으로 나눠요',
  manual: '종목마다 비중을 직접 넣어요 · 남는 만큼 현금',
  mcap: '시가총액이 클수록 더 많이',
  invvol: '최근 12개월 변동성이 낮을수록 더 많이',
};
const REB = { N: '안 함', M: '월간', Q: '분기', Y: '연 1회' };
const COSTS = [5, 10, 25];
const MAX_CASH = 50;
const p1 = (v) => `${(v * 100).toFixed(1)}%`;

const toDraft = (p) => ({
  id: p.portfolio_id, name: p.name, universe: p.universe, weighting: p.weighting, cash_pct: p.cash_pct,
  rebalance: p.rebalance, cost_bps: p.cost_bps, overlay: p.overlay || null,
  picks: p.items.map((i) => i.symbol),
  manual: Object.fromEntries(p.items.filter((i) => i.weight != null).map((i) => [i.symbol, i.weight])),
});

const toBody = (d) => ({
  name: d.name.trim() || '이름 없는 포트폴리오', universe: d.universe, weighting: d.weighting,
  cash_pct: d.weighting === 'manual' ? 0 : Number(d.cash_pct) || 0, rebalance: d.rebalance, cost_bps: Number(d.cost_bps),
  overlay: d.overlay || null,
  items: d.picks.map((s) => ({ symbol: s, weight: d.weighting === 'manual' ? Number(d.manual[s]) || 0 : null })),
});

/** 목표 비중 (0~1) — 서버 target_weights 와 같은 규칙 */
function weightsOf(d, bySym) {
  const picks = d.picks.filter((s) => bySym[s]);
  if (d.weighting === 'manual') return Object.fromEntries(picks.map((s) => [s, (Number(d.manual[s]) || 0) / 100]));
  const cash = Math.min(MAX_CASH, Math.max(0, Number(d.cash_pct) || 0)) / 100;
  const raw = (s) => (d.weighting === 'mcap' ? bySym[s].mcap || 0 : d.weighting === 'invvol' ? (bySym[s].vol ? 1 / bySym[s].vol : 0) : 1);
  let vals = Object.fromEntries(picks.map((s) => [s, raw(s)]));
  let total = Object.values(vals).reduce((a, b) => a + b, 0);
  if (total <= 0) { vals = Object.fromEntries(picks.map((s) => [s, 1])); total = picks.length || 1; }
  return Object.fromEntries(picks.map((s) => [s, (vals[s] / total) * (1 - cash)]));
}

export default function PortfolioSettings({ onRemove }) {
  const navigate = useNavigate();
  const shared = useShared();
  const [list, setList] = useState(null);
  const [universes, setUniverses] = useState([{ id: 'sp500', name: 'S&P 500' }]);
  const [catalog, setCatalog] = useState({});
  const [macroLoaded, setMacroLoaded] = useState([]);   // 패널에 적재된 매크로 지표
  const [members, setMembers] = useState({});   // universe → rows
  const [sel, setSel] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');
  const [q, setQ] = useState('');
  const [secF, setSecF] = useState('전체');
  const [pendUni, setPendUni] = useState('');

  const load = useCallback(async () => {
    const r = await apiClient.get(`${API_BASE}/quant-portfolios`);
    setList(r.results || []);
    if (r.metadata?.universes?.length) setUniverses(r.metadata.universes);
    setCatalog(r.metadata || {});
    return r.results || [];
  }, []);
  useEffect(() => { load().catch(() => setList([])); }, [load]);

  useEffect(() => {
    if (!list?.length || (sel && list.some((p) => p.portfolio_id === sel))) return;
    const fromShared = String(shared.strategy || '').startsWith('pf:') ? shared.strategy.slice(3) : null;
    setSel((list.find((p) => p.portfolio_id === fromShared) || list[0]).portfolio_id);
    setDraft(null);
  }, [list, sel, shared.strategy]);

  const base = list?.find((p) => p.portfolio_id === sel);
  const cur = useMemo(() => draft || (base ? toDraft(base) : null), [draft, base]);
  const dirty = !!draft;
  const upd = (patch) => { setDraft({ ...cur, ...patch }); setFlash(''); };

  // 유니버스 종목 (한 번 읽으면 둔다)
  const uni = cur?.universe;
  useEffect(() => {
    if (!uni || members[uni]) return;
    apiClient.get(`${API_BASE}/quant-portfolios/universe?universe=${encodeURIComponent(uni)}`)
      .then((r) => {
        setMembers((m) => ({ ...m, [uni]: r.results || [] }));
        setMacroLoaded(r.metadata?.macro || []);
      })
      .catch(() => setMembers((m) => ({ ...m, [uni]: [] })));
  }, [uni, members]);

  const rowsAll = (uni && members[uni]) || null;
  const bySym = useMemo(() => Object.fromEntries((rowsAll || []).map((r) => [r.symbol, r])), [rowsAll]);
  const picks = cur && rowsAll ? cur.picks.filter((s) => bySym[s]) : (cur?.picks || []);
  const w = useMemo(() => (cur && rowsAll ? weightsOf(cur, bySym) : {}), [cur, rowsAll, bySym]);
  const stock = Object.values(w).reduce((a, b) => a + b, 0);
  const cashV = Math.max(0, 1 - stock);
  const isManual = cur?.weighting === 'manual';
  const over = stock > 1.0005;
  const maxW = Math.max(0, ...Object.values(w));

  const pick = async (id) => {
    if (id === sel) return;
    if (dirty && !(await confirmDialog('저장하지 않은 변경이 있어요. 버리고 다른 포트폴리오를 열까요?'))) return;
    setSel(id); setDraft(null); setFlash(''); setQ(''); setSecF('전체'); setPendUni('');
  };

  const run = async (fn, done) => {
    setBusy(true);
    try {
      const res = await fn();
      const rows = await load();
      const id = res?.results?.[0]?.portfolio_id;
      setSel(id || rows[0]?.portfolio_id || null);
      setDraft(null);
      setFlash(done);
      setShared('bt_rev', String(Date.now()));
    } catch (e) {
      notify.fail(e, '처리하지 못했어요');
    } finally {
      setBusy(false);
    }
  };
  const save = () => run(() => apiClient.put(`${API_BASE}/quant-portfolios/${cur.id}`, toBody(cur)), '저장했어요');
  const dup = () => run(() => apiClient.post(`${API_BASE}/quant-portfolios`, { ...toBody(cur), name: `${cur.name} 사본` }), '복제했어요');
  const del = async () => {
    if (!(await confirmDialog(`'${cur.name}' 포트폴리오를 지울까요?`))) return;
    run(() => apiClient.del(`${API_BASE}/quant-portfolios/${cur.id}`), '삭제했어요');
  };
  const addNew = () => run(() => apiClient.post(`${API_BASE}/quant-portfolios`, {
    name: '새 포트폴리오', universe: universes[0]?.id || 'sp500', weighting: 'equal', cash_pct: 0, rebalance: 'Q', cost_bps: 10, items: [],
  }), '새 포트폴리오를 만들었어요');

  const backtest = () => {
    setShared('strategy', `pf:${cur.id}`);
    setShared('bt_rev', String(Date.now()));
    navigate('/backtest');
  };

  // ── 종목 고르기 ──
  const query = q.trim().toLowerCase();
  const sectors = useMemo(() => ['전체', ...new Set((rowsAll || []).map((r) => r.sector))], [rowsAll]);
  const visible = (rowsAll || []).filter((r) => (secF === '전체' || r.sector === secF)
    && (!query || r.symbol.toLowerCase().includes(query) || String(r.name || '').toLowerCase().includes(query)));
  const allVisibleOn = visible.length > 0 && visible.every((r) => picks.includes(r.symbol));
  const toggle = (sym) => upd({ picks: cur.picks.includes(sym) ? cur.picks.filter((x) => x !== sym) : [...cur.picks, sym] });
  const selectVisible = () => {
    const vs = visible.map((r) => r.symbol);
    upd({ picks: allVisibleOn ? cur.picks.filter((x) => !vs.includes(x)) : [...cur.picks, ...vs.filter((s) => !cur.picks.includes(s))] });
  };
  const switchUni = (k) => {
    if (k === cur.universe) return;
    if (picks.length) { setPendUni(k); return; }
    upd({ universe: k, picks: [], manual: {} }); setSecF('전체'); setQ('');
  };
  const setWeighting = (k) => {
    if (k === 'manual' && !isManual) upd({ weighting: k, manual: Object.fromEntries(picks.map((s) => [s, Math.round((w[s] || 0) * 100)])) });
    else upd({ weighting: k });
  };

  let warn = '';
  if (isManual && over) warn = `비중 합계가 ${p1(stock)}예요 · 100% 이하로 맞춰 주세요`;
  else if (isManual && picks.some((s) => !(Number(cur.manual[s]) > 0))) warn = '비중이 0%인 종목이 있어요 · 값을 넣거나 빼 주세요';
  else if (picks.length && maxW > 0.25) warn = picks.length < 5 ? `종목이 ${picks.length}개뿐이라 한 종목 비중이 커요` : `한 종목 비중이 ${p1(maxW)}로 커요`;

  const uniName = (id) => universes.find((u) => u.id === id)?.name || id;
  const summaryOf = (p) => `${uniName(p.universe)} · ${(p.items || p.picks).length}종목 · ${WT[p.weighting]} · 리밸런싱 ${REB[p.rebalance]}${p.overlay?.rules?.length ? ` · 매크로 조건 ${p.overlay.rules.length}개` : ''}`;
  const picked = [...picks].sort((a, b) => (w[b] || 0) - (w[a] || 0));

  return (
    <WidgetCard
      title="포트폴리오 설정"
      source="db"
      sourceNote="유니버스를 고르고, 그 안에서 담을 종목을 직접 골라요 · 시가총액 = 종목 프로필 · 변동성 = 최근 12개월"
      onRemove={onRemove}
      loading={!list}
    >
      <div className="h-full min-h-0 grid grid-cols-1 md:grid-cols-[minmax(200px,240px)_minmax(0,1fr)] gap-2 p-2">

        <section aria-label="포트폴리오 목록" className={PANEL}>
          <div className="flex items-center gap-2 h-12 px-3 flex-shrink-0 border-b border-[var(--mp-tag)]">
            <span className="text-[13px] font-bold">내 포트폴리오</span>
            <span className="text-[11px] text-[var(--mp-muted)]">{list?.length ?? ''}</span>
            <button type="button" onClick={addNew} disabled={busy} className={`${BTN_GHOST} ml-auto !h-[30px] !px-2.5 !text-xs`}>
              <Plus size={13} aria-hidden="true" />새로 만들기
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-2 flex flex-col gap-0.5">
            {(list || []).map((p) => {
              const shown = p.portfolio_id === sel && draft ? { ...p, ...draft, items: draft.picks } : p;
              return (
                <ListItem key={p.portfolio_id} on={p.portfolio_id === sel} onClick={() => pick(p.portfolio_id)}
                  title={shown.name} sub={summaryOf(shown)} />
              );
            })}
            {list && !list.length && (
              <span className="px-1 py-2.5 text-xs text-[var(--mp-muted)]">아직 없어요 · '새로 만들기'로 시작해요</span>
            )}
          </div>
        </section>

        {cur ? (
          <section aria-label="포트폴리오 편집" className={PANEL}>
            <div className="flex flex-wrap items-end gap-2.5 px-4 py-3 flex-shrink-0 border-b border-[var(--mp-tag)]">
              <label className="flex flex-col gap-1 flex-[1_1_240px] min-w-0">
                <span className={LBL}>이름</span>
                <input className={`${FIELD} font-semibold text-sm`} type="text" value={cur.name} maxLength={100}
                  onChange={(e) => upd({ name: e.target.value })} />
              </label>
              {dirty && <span className="mb-2 h-[22px] px-2 flex items-center rounded-md bg-[var(--mp-raised)] text-[var(--mp-text-2)] text-[10.5px] font-semibold">저장 안 됨</span>}
              {flash && <span role="status" className="mb-2.5 text-xs text-[#8FB8FF]">{flash}</span>}
              <span className="flex gap-2">
                <button type="button" className={BTN_GHOST} onClick={dup} disabled={busy}>복제</button>
                <button type="button" className={BTN_GHOST} onClick={del} disabled={busy}>삭제</button>
                <button type="button" className={BTN_PRIMARY} onClick={save} disabled={!dirty || (isManual && over) || busy}>저장</button>
              </span>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
              <div className="min-h-0 flex flex-col lg:border-r border-[var(--mp-tag)]">
                <div className="flex flex-col gap-2.5 px-4 pt-3.5 pb-2.5 flex-shrink-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className={LBL}>유니버스</span>
                    <Seg
                      label="유니버스" value={cur.universe} onChange={switchUni} size="sm"
                      items={universes.map((u) => ({ id: u.id, label: u.name, sub: members[u.id] ? members[u.id].length : undefined }))}
                    />
                  </div>
                  {pendUni && (
                    <div role="alert" className="flex flex-wrap items-center gap-2 px-2.5 py-2 rounded-md bg-[#1B2A44] text-[#CFE0FF] text-xs">
                      <span className="flex-[1_1_220px]">{uniName(pendUni)}로 바꾸면 담은 {picks.length}종목이 비워져요</span>
                      <button type="button" className={`${BTN_PRIMARY} !h-7 !text-xs`} onClick={() => { upd({ universe: pendUni, picks: [], manual: {} }); setPendUni(''); setSecF('전체'); setQ(''); }}>바꾸기</button>
                      <button type="button" className={`${BTN_GHOST} !h-7 !text-xs`} onClick={() => setPendUni('')}>취소</button>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex-[1_1_200px] flex items-center gap-2 h-[34px] px-2.5 rounded-md border border-[var(--mp-tile-line)] bg-[var(--mp-raised)] text-[var(--mp-muted)]">
                      <Search size={14} aria-hidden="true" />
                      <span className="sr-only">유니버스 안에서 종목 찾기</span>
                      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="티커 · 종목명"
                        className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[var(--mp-text)] text-[13px]" />
                    </label>
                    <button type="button" className={`${BTN_GHOST} !h-[34px] !text-xs`} onClick={selectVisible} disabled={!visible.length}>
                      {allVisibleOn ? '보이는 종목 모두 빼기' : '보이는 종목 모두 담기'}
                    </button>
                  </div>
                  <div role="group" aria-label="섹터 필터" className="flex flex-wrap gap-1">
                    {sectors.map((k) => {
                      const on = k === secF;
                      const n = k === '전체' ? picks.length : picks.filter((s) => bySym[s]?.sector === k).length;
                      return (
                        <button key={k} type="button" aria-pressed={on} onClick={() => setSecF(k)}
                          className={`h-7 px-2.5 rounded-md text-xs whitespace-nowrap border ${on ? 'border-[var(--mp-accent)] bg-[rgba(49,130,246,0.12)] text-[#CFE0FF]' : 'border-[var(--mp-tile-line)] text-[var(--mp-text-2)] hover:text-[var(--mp-text)]'}`}>
                          {k}{n ? ` · ${n}` : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 h-[26px] px-3 text-[11px] text-[var(--mp-muted)] flex-shrink-0 border-t border-[var(--mp-tag)]">
                  <span className="w-4" /><span className="w-[68px]">티커</span><span className="flex-1">종목명</span><span className="w-24">섹터</span>
                </div>
                <div role="group" aria-label="종목 선택" className="flex-1 min-h-0 overflow-auto">
                  {!rowsAll && <p className="m-0 px-4 py-6 text-center text-xs text-[var(--mp-muted)]">종목을 불러오는 중…</p>}
                  {visible.map((r) => {
                    const on = picks.includes(r.symbol);
                    return (
                      <button key={r.symbol} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(r.symbol)}
                        className={`w-full flex items-center gap-2.5 min-h-10 px-3 border-t border-[var(--mpc-grid)] text-left text-[var(--mp-text)] hover:bg-[var(--mpc-grid)] ${on ? 'bg-[rgba(49,130,246,0.06)]' : ''}`}>
                        <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${on ? 'bg-[var(--mp-accent)]' : 'border-[1.5px] border-[var(--mp-grip)]'}`}>
                          {on && <Check size={11} strokeWidth={3.2} className="text-white" aria-hidden="true" />}
                        </span>
                        <span className="w-[68px] font-bold">{r.symbol}</span>
                        <span className="flex-1 min-w-0 truncate text-[var(--mp-text-2)]">{r.name}</span>
                        <span className="w-24 text-xs text-[var(--mp-muted)] whitespace-nowrap truncate">{r.sector}</span>
                      </button>
                    );
                  })}
                  {rowsAll && !visible.length && (
                    <p className="m-0 px-4 py-6 text-center text-xs text-[var(--mp-muted)]">
                      {rowsAll.length ? '조건에 맞는 종목이 없어요' : '유니버스 종목이 아직 적재되지 않았어요 — 로컬에서 build_quant.py 를 실행해 주세요'}
                    </p>
                  )}
                </div>
                <p className="m-0 px-3 py-2 text-[11px] text-[var(--mp-faint)] border-t border-[var(--mp-tag)] flex-shrink-0">
                  {uniName(cur.universe)} {rowsAll?.length ?? 0}종목 · {visible.length}종목 보임 · {picks.length}종목 담음
                </p>
              </div>

              <aside aria-label="담은 종목" className="min-h-0 overflow-auto bg-[#0F0F11] flex flex-col">
                <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
                  <span className="text-[13px] font-bold">담은 종목</span>
                  <span className="text-xs text-[var(--mp-muted)]">{picks.length}종목</span>
                  {picks.length > 0 && (
                    <button type="button" className={`${BTN_GHOST} ml-auto !h-[26px] !px-2 !text-[11.5px]`} onClick={() => upd({ picks: [], manual: {} })}>모두 빼기</button>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 px-4 pb-2.5">
                  <span className={LBL}>비중 방식</span>
                  <Seg label="비중 방식" size="sm" value={cur.weighting} onChange={setWeighting}
                    items={Object.entries(WT).map(([id, label]) => ({ id, label }))} />
                  <span className="text-[11.5px] text-[var(--mp-muted)]">{WT_NOTE[cur.weighting]}</span>
                </div>

                {picks.length > 0 ? (
                  <>
                    <div className="flex flex-col">
                      {picked.map((s) => (
                        <div key={s} className="flex items-center gap-2 min-h-[38px] pl-4 pr-2.5 border-t border-[var(--mpc-grid)]">
                          <span className="flex-1 min-w-0 flex items-baseline gap-2">
                            <span className="font-bold">{s}</span>
                            <span className="text-[11px] text-[var(--mp-muted)] truncate">{bySym[s]?.name} · {bySym[s]?.sector}</span>
                          </span>
                          {isManual ? (
                            <span className="flex items-center gap-1">
                              <input className={`${FIELD} !h-7 w-14 !px-1.5 text-right`} type="number" min="0" max="100" step="1"
                                value={String(Number(cur.manual[s]) || 0)} aria-label={`${s} 비중 (%)`}
                                onChange={(e) => upd({ manual: { ...cur.manual, [s]: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) } })} />
                              <span className="text-[11.5px] text-[var(--mp-muted)]">%</span>
                            </span>
                          ) : (
                            <span className="w-12 text-right font-semibold">{p1(w[s] || 0)}</span>
                          )}
                          <button type="button" aria-label={`${s} 빼기`} onClick={() => toggle(s)}
                            className="w-6 h-6 rounded flex items-center justify-center text-[var(--mp-muted)] hover:bg-[var(--mp-raised)] hover:text-[var(--mp-text)]">
                            <X size={11} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 px-4 py-2.5 border-t border-[var(--mp-tag)] text-xs text-[var(--mp-muted)]">
                      <span>주식 <span className="font-bold text-[var(--mp-text)]">{p1(stock)}</span></span>
                      <span>현금 <span className="font-bold text-[var(--mp-text)]">{p1(cashV)}</span></span>
                      {!isManual && (
                        <label className="ml-auto flex items-center gap-1.5">현금 비중
                          <input className={`${FIELD} !h-7 w-[52px] !px-1.5 text-right`} type="number" min="0" max={MAX_CASH} step="1"
                            value={String(cur.cash_pct ?? 0)}
                            onChange={(e) => upd({ cash_pct: Math.max(0, Math.min(MAX_CASH, Math.round(Number(e.target.value) || 0))) })} />%
                        </label>
                      )}
                    </div>
                    {warn && <p role="status" className="mx-4 mb-2 px-2.5 py-2 rounded-md bg-[#1B2A44] text-[#CFE0FF] text-xs">{warn}</p>}
                  </>
                ) : (
                  <div className="mx-4 my-1.5 px-3 py-7 border border-dashed border-[var(--mp-tile-line)] rounded-md text-center text-xs text-[var(--mp-muted)]">
                    왼쪽 목록에서 담을 종목을 골라 주세요
                  </div>
                )}

                <div className="mt-auto flex flex-col gap-2 px-4 py-3 border-t border-[var(--mp-tag)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`${LBL} w-[72px]`}>리밸런싱</span>
                    <Seg label="목표 비중으로 되돌리는 주기" size="sm" value={cur.rebalance} onChange={(k) => upd({ rebalance: k })}
                      items={Object.entries(REB).map(([id, label]) => ({ id, label }))} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`${LBL} w-[72px]`}>거래비용</span>
                    <Seg label="거래비용 (편도)" size="sm" value={Number(cur.cost_bps)} onChange={(k) => upd({ cost_bps: k })}
                      items={COSTS.map((c) => ({ id: c, label: `${c}bp` }))} />
                  </div>
                  <span className="text-[11.5px] text-[var(--mp-muted)]">리밸런싱 = 가격이 움직여 달라진 비중을 목표 비중으로 되돌리기</span>
                </div>
                <div className="px-4 py-3 border-t border-[var(--mp-tag)]">
                  <OverlayEditor value={cur.overlay} onChange={(o) => upd({ overlay: o })} catalog={catalog} loaded={macroLoaded} />
                </div>
              </aside>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 flex-shrink-0 border-t border-[var(--mp-tag)] bg-[var(--mp-raised)]/40">
              <span className={LBL}>요약</span>
              <span className="text-[13px] font-semibold">{summaryOf({ ...cur, items: picks })}{cashV > 0.0005 && picks.length ? ` · 현금 ${p1(cashV)}` : ''}</span>
              <span className="ml-auto flex gap-2">
                <button type="button" className={BTN_GHOST} onClick={() => navigate('/quantlib?tab=factors')}>메인에서 보기</button>
                <button type="button" className={BTN_PRIMARY} onClick={backtest} disabled={dirty || !picks.length}
                  title={dirty ? '저장한 뒤 백테스트할 수 있어요' : !picks.length ? '종목을 하나 이상 담아 주세요' : undefined}>
                  이 포트폴리오로 백테스트<ArrowRight size={14} aria-hidden="true" />
                </button>
              </span>
            </div>
          </section>
        ) : (
          list && (
            <section className={`${PANEL} items-center justify-center gap-3 p-8 text-center`}>
              <span className="text-[13px] font-bold">아직 포트폴리오가 없어요</span>
              <span className="text-xs text-[var(--mp-muted)]">유니버스를 고르고 그 안에서 담을 종목을 직접 골라요</span>
              <button type="button" className={BTN_PRIMARY} onClick={addNew} disabled={busy}><Plus size={14} aria-hidden="true" />새로 만들기</button>
            </section>
          )
        )}
      </div>
    </WidgetCard>
  );
}
