/**
 * QuantWorkflow — 퀀트 머리줄 (시안 Quant.dc.html 맨 위 줄): 유니버스 · 리밸런싱 · 단계 ①②③ · 기간 · 백테스트로 보내기.
 *
 *   유니버스   화면 변수 universe — 퀀트 위젯 4개가 같이 따른다
 *   리밸런싱   화면 변수 quant_rebalance — 보낼 전략의 리밸런싱 (서버 전략이 고를 수 있는 값만)
 *   단계       화면 변수 quant_step — 그 단계의 위젯(옵션 highlight)이 테두리로 강조된다
 *   보내기     팩터 표에서 켠 팩터(화면 변수 quant_off 가 꺼 둔 목록)의 동일 비중 전략을 만들어 /backtest 로 간다.
 *             같은 조합의 전략이 이미 있으면(기본 제공 포함) 새로 만들지 않고 그걸 고른다
 *
 * 값을 다시 계산하지 않는다 — 퀀트 값은 배치가 적재한 것이고, 백테스트는 서버가 월별 패널로 바로 계산한다.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { apiClient, API_BASE, notify } from '../../../common';
import { setShared, useShared } from '../../engine/shared';

// 배치(build_quant.py)가 적재하는 유니버스 — 늘리면 여기와 위젯의 universe 선택지를 같이 늘린다
const UNIVERSES = [{ id: 'sp500', name: 'S&P 500' }];
const REBALANCE = [{ id: 'M', name: '월간' }, { id: 'Q', name: '분기' }];
const TOP_N = 30;

const STEPS = [
  { id: 'factor', label: '팩터 빌더', sub: '신호 재료 고르기' },
  { id: 'ml', label: 'ML 파이프라인', sub: 'GBT · MLP · 로지스틱 · HMM' },
  { id: 'fusion', label: '시그널 융합', sub: '최종 점수 · 종목 선정' },
];

const SELECT = 'flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-[var(--mp-raised)] text-xs text-[var(--mp-muted)]';
const ym = (d) => (d ? String(d).slice(0, 7).replace('-', '.') : '');

/** 켠 팩터가 같고(동일 비중) 리밸런싱·보유 수가 같은 전략 */
function sameStrategy(s, ids, rebalance) {
  if (s.score_kind !== 'factor' || s.rebalance !== rebalance || s.top_n !== TOP_N) return false;
  const ws = s.factors.map((f) => f.weight);
  return s.factors.length === ids.length && ws.every((w) => w === ws[0])
    && s.factors.every((f) => ids.includes(f.factor_id));
}

export default function QuantWorkflow() {
  const navigate = useNavigate();
  const shared = useShared();
  const universe = shared.universe || UNIVERSES[0].id;
  const step = shared.quant_step || 'factor';
  const [catalog, setCatalog] = useState(null);
  const [period, setPeriod] = useState('');
  const [sending, setSending] = useState(false);

  const rebalances = catalog?.rebalance?.length ? catalog.rebalance : REBALANCE;
  const rebalance = rebalances.some((r) => r.id === shared.quant_rebalance) ? shared.quant_rebalance : 'M';
  const off = String(shared.quant_off || '').split(',').filter(Boolean);
  const factors = (catalog?.factors || []).filter((f) => !off.includes(f.id));

  useEffect(() => {
    apiClient.get(`${API_BASE}/strategies`).then((r) => setCatalog(r.metadata || {})).catch(() => setCatalog({}));
  }, []);

  // 기간 — 팩터 검증 기간 + 모델 학습 · 표본 밖 개월 (적재 전이면 비운다)
  useEffect(() => {
    let alive = true;
    const q = `universe=${encodeURIComponent(universe)}`;
    Promise.all([
      apiClient.get(`${API_BASE}/quant/factors?${q}`).catch(() => null),
      apiClient.get(`${API_BASE}/quant/models?${q}`).catch(() => null),
    ]).then(([f, m]) => {
      if (!alive) return;
      const fm = f?.metadata || {};
      const mm = m?.metadata || {};
      setPeriod([
        fm.start && fm.end ? `기간 ${ym(fm.start)}–${ym(fm.end)}` : null,
        mm.train_months ? `학습 ${mm.train_months}개월` : null,
        mm.oos_months ? `표본 밖 ${mm.oos_months}개월` : null,
      ].filter(Boolean).join(' · '));
    });
    return () => { alive = false; };
  }, [universe]);

  const send = async () => {
    if (!factors.length || sending) return;
    setSending(true);
    try {
      const ids = factors.map((f) => f.id);
      const res = await apiClient.get(`${API_BASE}/strategies`);
      let target = (res.results || []).find((s) => sameStrategy(s, ids, rebalance));
      if (!target) {
        const names = factors.map((f) => f.name);
        const reb = rebalances.find((r) => r.id === rebalance)?.name || rebalance;
        const created = await apiClient.post(`${API_BASE}/strategies`, {
          name: `퀀트 · ${names.length > 3 ? `팩터 ${names.length}개` : names.join(' + ')} · ${reb}`,
          description: `퀀트 화면에서 보냄 — ${names.join(', ')} 동일 비중`,
          score_kind: 'factor',
          factors: ids.map((id) => ({ factor_id: id, weight: 1 })),
          top_n: TOP_N,
          rebalance,
        });
        target = created.results?.[0];
      }
      if (!target) throw new Error('전략을 만들지 못했어요');
      setShared('strategy', target.strategy_id);
      setShared('bt_rev', String(Date.now()));   // 결과 위젯이 다시 부르게
      navigate('/backtest');
    } catch (e) {
      notify.fail(e, '백테스트로 보내지 못했어요');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
      <label className={SELECT}>
        유니버스
        <select
          value={universe}
          onChange={(e) => setShared('universe', e.target.value)}
          className="bg-transparent text-[var(--mp-text)] font-bold outline-none [&_option]:bg-[var(--mp-panel)]"
        >
          {UNIVERSES.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </label>
      <label className={SELECT}>
        리밸런싱
        <select
          value={rebalance}
          onChange={(e) => setShared('quant_rebalance', e.target.value)}
          className="bg-transparent text-[var(--mp-text)] font-bold outline-none [&_option]:bg-[var(--mp-panel)]"
        >
          {rebalances.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>

      <ol aria-label="워크플로 단계" className="flex flex-wrap items-center gap-0.5 m-0 ml-1 p-0 list-none">
        {STEPS.map((s, i) => {
          const on = s.id === step;
          return (
            <li key={s.id} className="flex items-center gap-0.5">
              <button
                type="button"
                aria-pressed={on}
                onClick={() => setShared('quant_step', s.id)}
                className={`flex items-center gap-2 h-9 pl-1.5 pr-3 rounded-md transition-colors ${on ? 'bg-[var(--mp-raised)] text-[var(--mp-text)]' : 'text-[var(--mp-muted)] hover:text-[var(--mp-text)]'}`}
              >
                <span className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold text-white ${on ? 'bg-[var(--mp-accent)]' : 'bg-[var(--mp-chip-on)]'}`}>{i + 1}</span>
                <span className="flex flex-col items-start leading-tight">
                  <span className="text-xs font-bold">{s.label}</span>
                  <span className="text-[10.5px] text-[var(--mp-muted)]">{s.sub}</span>
                </span>
              </button>
              {i < STEPS.length - 1 && <ChevronRight size={14} className="text-[var(--mp-grip)]" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      {period && <span className="ml-auto text-[11px] text-[var(--mp-faint)] whitespace-nowrap">{period}</span>}
      <button
        type="button"
        onClick={send}
        disabled={!factors.length || sending}
        title={factors.length
          ? `켠 팩터 ${factors.length}개 동일 비중 · ${rebalances.find((r) => r.id === rebalance)?.name} · 상위 ${TOP_N}종목으로 백테스트`
          : '팩터를 하나 이상 켜 주세요'}
        className={`${period ? '' : 'ml-auto'} flex items-center gap-1.5 h-8 px-3 rounded-md bg-[var(--mp-accent)] text-white text-xs font-bold whitespace-nowrap hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none`}
      >
        {sending ? '보내는 중…' : '백테스트로 보내기'}
        <ArrowRight size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
