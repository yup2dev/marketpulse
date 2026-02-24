import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, FlaskConical, Save, Info } from 'lucide-react';
import {
  FACTORS, FACTOR_GROUPS, FACTOR_STATUS, GROUP_META,
} from '../../data/factorDefinitions';
import { quantAPI } from '../../config/api';
import toast from 'react-hot-toast';

// ── 생성 가능한 팩터 타입 (built-in 제외, 신규/확장형) ─────────────────────────
const CREATABLE_CATEGORIES = [
  {
    id: 'Market Sensitivity',
    label: '시장 민감도',
    types: [
      {
        id: 'BETA', label: 'Beta',
        desc: '시장 수익률 대비 민감도 (β > 1 = 시장보다 고변동)',
        formula: 'β = Cov(r_asset, r_market) / Var(r_market)',
        status: 'external',
        params: [
          { name: 'window',    label: '롤링 기간 (일)', default: 60,    type: 'number', min: 20, max: 252 },
          { name: 'vs_ticker', label: '기준 지수',       default: 'SPY', type: 'text' },
        ],
      },
      {
        id: 'CORR', label: 'Correlation',
        desc: '기준 종목과의 롤링 상관계수 (−1 ~ +1)',
        formula: 'ρ = Cov(r_a, r_b) / (σ_a × σ_b)',
        status: 'external',
        params: [
          { name: 'window',    label: '롤링 기간 (일)', default: 20,    type: 'number', min: 10, max: 252 },
          { name: 'vs_ticker', label: '기준 종목',       default: 'SPY', type: 'text' },
        ],
      },
      {
        id: 'REL_STR', label: 'Relative Strength',
        desc: '기준 지수 대비 상대 수익률 비율',
        formula: 'RS = (P / P₀) / (Ref / Ref₀)',
        status: 'external',
        params: [
          { name: 'period',    label: '기간 (일)', default: 20,    type: 'number', min: 5, max: 252 },
          { name: 'vs_ticker', label: '기준 지수', default: 'SPY', type: 'text' },
        ],
      },
    ],
  },
  {
    id: 'Sentiment',
    label: '뉴스/감성',
    types: [
      {
        id: 'NEWS_SENTIMENT', label: 'News Sentiment Score',
        desc: 'N일 평균 뉴스 감성 점수 (−1 부정 ~ +1 긍정)',
        formula: 'S = mean(sentiment_score, lookback)',
        status: 'external',
        dataSource: 'MarketPulse 뉴스 분석 DB',
        params: [
          { name: 'lookback', label: '분석 기간 (일)', default: 5, type: 'number', min: 1, max: 30 },
        ],
      },
      {
        id: 'NEWS_VOLUME', label: 'News Volume',
        desc: 'N일 내 관련 기사 건수 — 시장 관심도 대리 지표',
        formula: 'V = count(articles, lookback)',
        status: 'external',
        dataSource: 'MarketPulse 뉴스 크롤링 DB',
        params: [
          { name: 'lookback', label: '분석 기간 (일)', default: 5, type: 'number', min: 1, max: 30 },
        ],
      },
      {
        id: 'SENTIMENT_DELTA', label: 'Sentiment Momentum',
        desc: '단기 감성과 장기 감성 점수의 차이 — 방향성 전환 감지',
        formula: 'ΔS = SentScore(fast) − SentScore(slow)',
        status: 'external',
        dataSource: 'MarketPulse 뉴스 분석 DB',
        params: [
          { name: 'fast', label: '단기 윈도우 (일)', default: 3,  type: 'number', min: 1, max: 14 },
          { name: 'slow', label: '장기 윈도우 (일)', default: 10, type: 'number', min: 3, max: 30 },
        ],
      },
    ],
  },
  {
    id: 'Statistical',
    label: '통계 지표',
    types: [
      {
        id: 'ZSCORE', label: 'Z-Score',
        desc: '현재 가격의 표준편차 단위 이격도 — 평균회귀 전략의 기초',
        formula: 'Z = (P − SMA(n)) / σ(n)',
        status: 'available',
        params: [
          { name: 'window', label: '윈도우 (일)', default: 20, type: 'number', min: 5, max: 252 },
        ],
      },
      {
        id: 'PERCENTILE', label: 'Percentile Rank',
        desc: 'n일 내 현재 가격의 상대 위치 — 0=최저, 100=최고',
        formula: 'PCT = rank(P in window) / n × 100',
        status: 'available',
        params: [
          { name: 'window', label: '윈도우 (일)', default: 60, type: 'number', min: 10, max: 252 },
        ],
      },
    ],
  },
];

// ── 팩터 라이브러리 아이템 ─────────────────────────────────────────────────────
const FactorItem = ({ factorKey, factor }) => {
  const meta   = GROUP_META[factor.group] || {};
  const isExt  = factor.status === 'external';
  const paramStr = factor.params.length
    ? factor.params.map(p => `${p.label}=${p.default}`).join(', ')
    : '—';

  return (
    <div className={`group px-3 py-2.5 border rounded-lg transition-colors ${
      isExt
        ? 'border-gray-800/50 bg-transparent opacity-70'
        : 'border-gray-800 bg-[#060608] hover:border-gray-700'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px]">{meta.icon}</span>
          <span className={`text-[11px] font-semibold truncate ${meta.color || 'text-gray-300'}`}>
            {factor.label}
          </span>
          {isExt && (
            <span className="text-[9px] px-1 py-0.5 rounded border border-yellow-800 text-yellow-500 bg-yellow-900/20 shrink-0">
              ext.
            </span>
          )}
        </div>
        <span className="text-[9px] text-gray-600 shrink-0 font-mono">{factorKey}</span>
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5 truncate">{factor.desc}</div>
      {factor.params.length > 0 && (
        <div className="text-[9px] text-gray-700 mt-0.5 font-mono truncate">{paramStr}</div>
      )}
      {factor.formula && (
        <div className="text-[9px] text-gray-600 mt-1 font-mono opacity-80 truncate">{factor.formula}</div>
      )}
    </div>
  );
};

// ── 그룹 섹션 ────────────────────────────────────────────────────────────────
const GroupSection = ({ group, factors }) => {
  const [open, setOpen] = useState(true);
  const meta = GROUP_META[group] || {};

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 py-1.5 text-left"
      >
        {open ? <ChevronDown size={11} className="text-gray-600" /> : <ChevronRight size={11} className="text-gray-600" />}
        <span className="text-[10px]">{meta.icon}</span>
        <span className={`text-[10px] font-semibold ${meta.color || 'text-gray-400'}`}>{group}</span>
        <span className="text-[9px] text-gray-600 ml-1">{meta.desc}</span>
        <span className="text-[9px] text-gray-700 ml-auto">{factors.length}</span>
      </button>
      {open && (
        <div className="space-y-1 mb-3">
          {factors.map(([key, f]) => (
            <FactorItem key={key} factorKey={key} factor={f} />
          ))}
        </div>
      )}
    </div>
  );
};

// ── 팩터 생성 폼 ─────────────────────────────────────────────────────────────
const FactorCreateForm = ({ onSaved }) => {
  const [category, setCategory]   = useState(CREATABLE_CATEGORIES[0].id);
  const [typeId,   setTypeId]     = useState(CREATABLE_CATEGORIES[0].types[0].id);
  const [name,     setName]       = useState('');
  const [desc,     setDesc]       = useState('');
  const [params,   setParams]     = useState({});
  const [saving,   setSaving]     = useState(false);

  const catDef  = CREATABLE_CATEGORIES.find(c => c.id === category);
  const typeDef = catDef?.types.find(t => t.id === typeId);

  // Reset type + params when category changes
  const handleCategoryChange = (cId) => {
    setCategory(cId);
    const cat = CREATABLE_CATEGORIES.find(c => c.id === cId);
    const firstType = cat?.types[0];
    setTypeId(firstType?.id || '');
    const defaults = {};
    firstType?.params.forEach(p => { defaults[p.name] = p.default; });
    setParams(defaults);
  };

  const handleTypeChange = (tId) => {
    setTypeId(tId);
    const t = catDef?.types.find(x => x.id === tId);
    const defaults = {};
    t?.params.forEach(p => { defaults[p.name] = p.default; });
    setParams(defaults);
  };

  const setParam = (name, val) => setParams(p => ({ ...p, [name]: val }));

  const handleSave = async () => {
    if (!name.trim()) { toast.error('팩터 이름을 입력하세요'); return; }
    setSaving(true);
    try {
      await quantAPI.createFactor({
        name: name.trim(),
        category,
        factor_type: typeId,
        params: JSON.stringify(params),
        formula: typeDef?.formula || '',
        description: desc.trim() || typeDef?.desc || '',
        status: typeDef?.status || 'available',
      });
      toast.success(`"${name}" 팩터가 저장됐습니다`);
      setName('');
      setDesc('');
      onSaved?.();
    } catch (err) {
      toast.error(err.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-gray-800 rounded-lg p-3 space-y-3 bg-[#060608]">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
        <FlaskConical size={11} className="text-cyan-400" />
        새 팩터 정의
      </div>

      {/* Name */}
      <div>
        <label className="block text-[9px] text-gray-500 uppercase mb-1">팩터 이름 *</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="예: My Beta Factor"
          className="w-full px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Category + Type */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-[9px] text-gray-500 uppercase mb-1">카테고리</label>
          <select
            value={category}
            onChange={e => handleCategoryChange(e.target.value)}
            className="w-full px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500"
          >
            {CREATABLE_CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[9px] text-gray-500 uppercase mb-1">타입</label>
          <select
            value={typeId}
            onChange={e => handleTypeChange(e.target.value)}
            className="w-full px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500"
          >
            {catDef?.types.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Type description + status */}
      {typeDef && (
        <div className={`text-[10px] px-2.5 py-2 rounded border space-y-1 ${
          typeDef.status === 'external'
            ? 'border-yellow-800/50 bg-yellow-900/10 text-yellow-400'
            : 'border-green-800/50 bg-green-900/10 text-green-400'
        }`}>
          <div>{typeDef.desc}</div>
          {typeDef.dataSource && (
            <div className="flex items-center gap-1 text-[9px] opacity-80">
              <Info size={9} />
              데이터 소스: {typeDef.dataSource}
            </div>
          )}
          {typeDef.status === 'external' && (
            <div className="text-[9px] opacity-70">⚠ 외부 데이터 연동 시 활성화됩니다</div>
          )}
        </div>
      )}

      {/* Parameters */}
      {typeDef?.params.length > 0 && (
        <div>
          <label className="block text-[9px] text-gray-500 uppercase mb-1.5">파라미터</label>
          <div className="space-y-1.5">
            {typeDef.params.map(p => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-28 shrink-0">{p.label}</span>
                <input
                  type={p.type || 'number'}
                  value={params[p.name] ?? p.default}
                  onChange={e => setParam(p.name, p.type === 'text' ? e.target.value : Number(e.target.value))}
                  min={p.min}
                  max={p.max}
                  className="flex-1 px-2 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500 tabular-nums"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formula Preview */}
      {typeDef?.formula && (
        <div className="border border-gray-800 rounded px-2.5 py-2">
          <div className="text-[9px] text-gray-600 uppercase mb-0.5">Formula</div>
          <div className="text-[10px] text-cyan-300 font-mono">{typeDef.formula}</div>
        </div>
      )}

      {/* Description */}
      <div>
        <label className="block text-[9px] text-gray-500 uppercase mb-1">메모 (선택)</label>
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="이 팩터를 어떻게 활용할 계획인지 메모…"
          className="w-full px-2 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-gray-300 focus:outline-none focus:border-cyan-500"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-4 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-[11px] font-semibold rounded transition-colors"
      >
        <Save size={12} />
        {saving ? '저장 중…' : '내 팩터에 저장'}
      </button>
    </div>
  );
};

// ── 내 커스텀 팩터 목록 ──────────────────────────────────────────────────────
const MyFactors = ({ factors, onDelete }) => {
  if (!factors.length) return (
    <div className="text-[11px] text-gray-600 border border-dashed border-gray-800 rounded-lg px-3 py-4 text-center">
      저장된 커스텀 팩터가 없습니다.
    </div>
  );

  const meta = (cat) => {
    const map = {
      'Market Sensitivity': { color: 'text-orange-400', icon: '🏦' },
      'Sentiment':          { color: 'text-rose-400',   icon: '📰' },
      'Statistical':        { color: 'text-blue-400',   icon: '📐' },
    };
    return map[cat] || { color: 'text-gray-400', icon: '🔧' };
  };

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <table className="w-full text-[11px]">
        <thead className="bg-[#0d0d12]">
          <tr>
            <th className="px-3 py-2 text-left text-[10px] text-gray-500 font-medium">이름</th>
            <th className="px-2 py-2 text-left text-[10px] text-gray-500 font-medium">타입</th>
            <th className="px-2 py-2 text-left text-[10px] text-gray-500 font-medium">파라미터</th>
            <th className="px-2 py-2 text-left text-[10px] text-gray-500 font-medium">상태</th>
            <th className="px-2 py-2 w-8" />
          </tr>
        </thead>
        <tbody>
          {factors.map(f => {
            const m = meta(f.category);
            let paramsStr = '—';
            try {
              const p = JSON.parse(f.params || '{}');
              paramsStr = Object.entries(p).map(([k, v]) => `${k}=${v}`).join(', ') || '—';
            } catch (_) {}

            return (
              <tr key={f.id} className="border-t border-gray-800/50 hover:bg-gray-800/20">
                <td className="px-3 py-2">
                  <span className="mr-1">{m.icon}</span>
                  <span className={`font-medium ${m.color}`}>{f.name}</span>
                </td>
                <td className="px-2 py-2 text-gray-400 font-mono text-[10px]">{f.factor_type}</td>
                <td className="px-2 py-2 text-gray-500 font-mono text-[10px]">{paramsStr}</td>
                <td className="px-2 py-2">
                  {f.status === 'external'
                    ? <span className="text-[9px] px-1 py-0.5 rounded border border-yellow-800 text-yellow-500">ext.</span>
                    : <span className="text-[9px] px-1 py-0.5 rounded border border-green-800 text-green-500">ready</span>
                  }
                </td>
                <td className="px-2 py-2">
                  <button
                    onClick={() => onDelete(f.id)}
                    className="p-1 text-gray-700 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={11} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
const FactorBuilderTab = () => {
  const [filterGroup,   setFilterGroup]   = useState('all');
  const [showCreate,    setShowCreate]    = useState(false);
  const [myFactors,     setMyFactors]     = useState([]);
  const [loadingMine,   setLoadingMine]   = useState(false);

  const loadMyFactors = async () => {
    setLoadingMine(true);
    try {
      const res = await quantAPI.listFactors();
      setMyFactors(res.data || []);
    } catch (_) {
      // not authenticated or no factors yet
    } finally {
      setLoadingMine(false);
    }
  };

  useEffect(() => { loadMyFactors(); }, []);

  const handleDelete = async (id) => {
    try {
      await quantAPI.deleteFactor(id);
      setMyFactors(f => f.filter(x => x.id !== id));
      toast.success('팩터 삭제 완료');
    } catch (err) {
      toast.error(err.message || '삭제 실패');
    }
  };

  // Build filtered factor list
  const groupedFactors = FACTOR_GROUPS
    .filter(g => filterGroup === 'all' || g === filterGroup)
    .map(g => {
      const items = Object.entries(FACTORS).filter(([, v]) => v.group === g);
      return { group: g, items };
    })
    .filter(({ items }) => items.length > 0);

  const filterPills = ['all', 'Trend', 'Momentum', 'Volatility', 'Statistical', 'Market Sensitivity', 'Sentiment'];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div>
          <div className="text-xs font-semibold text-white">Factor Library</div>
          <div className="text-[10px] text-gray-500 mt-0.5">팩터 탐색 · 생성 · 저장</div>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded border transition-colors ${
            showCreate
              ? 'bg-cyan-900/40 border-cyan-600 text-cyan-300'
              : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
          }`}
        >
          <Plus size={11} />
          새 팩터
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* Create Form */}
        {showCreate && (
          <FactorCreateForm onSaved={() => { loadMyFactors(); setShowCreate(false); }} />
        )}

        {/* Filter pills */}
        <div className="flex flex-wrap gap-1">
          {filterPills.map(g => {
            const m = GROUP_META[g] || {};
            return (
              <button
                key={g}
                onClick={() => setFilterGroup(g)}
                className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                  filterGroup === g
                    ? 'bg-gray-700 border-gray-500 text-white'
                    : 'border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300'
                }`}
              >
                {g === 'all' ? 'All' : `${m.icon} ${g}`}
              </button>
            );
          })}
        </div>

        {/* Factor library */}
        <div className="space-y-1">
          {groupedFactors.map(({ group, items }) => (
            <GroupSection key={group} group={group} factors={items} />
          ))}
        </div>

        {/* My Custom Factors */}
        <div className="pt-2 border-t border-gray-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              내 커스텀 팩터
            </span>
            {loadingMine && (
              <span className="text-[9px] text-gray-600">로딩 중…</span>
            )}
          </div>
          <MyFactors factors={myFactors} onDelete={handleDelete} />
        </div>

      </div>
    </div>
  );
};

export default FactorBuilderTab;
