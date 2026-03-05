/**
 * StrategyBuilderDashboard — Factor-Based Strategy Builder
 *
 * Layout:
 *   Header  : 전략 선택 드롭다운 + New/Save/Run 버튼
 *   Tab bar : All | Macro | Micro | Stock | Alt Data | My Strategy
 *   Content : 팩터 테이블 (CommonTable) 또는 비주얼 조건 빌더
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Save, RefreshCw, Play, Settings, FlaskConical, ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import CommonTable from '../common/CommonTable';
import { quantAPI } from '../../config/api';
import {
  STRATEGY_FACTORS,
  CATEGORY_META,
  AVAILABILITY_META,
} from '../../data/strategyFactors';
import { buildVarOptions, toBECond, fromBECond, mkCondRow, makeVarName, parseParams } from './helpers';
import { TABS, TAB_CATEGORY_MAP } from './constants';
import StrategyDropdown from './StrategyDropdown';
import StrategyEditorTab from './StrategyEditorTab';

// ── Sub-components ────────────────────────────────────────────────────────────

const AvailBadge = ({ status }) => {
  const m = AVAILABILITY_META[status] || AVAILABILITY_META.available;
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${m.color}`}>
      {m.label}
    </span>
  );
};

const CatBadge = ({ category, sub }) => {
  const m = CATEGORY_META[category] || {};
  return (
    <span className={`text-[10px] font-medium ${m.color || 'text-gray-400'}`}>
      {sub}
    </span>
  );
};

// ── Factor table columns ──────────────────────────────────────────────────────

/** selectedFactors array → per-factorId count map */
const countByFactorId = (selectedFactors) =>
  selectedFactors.reduce((acc, f) => {
    acc[f.factorId] = (acc[f.factorId] || 0) + 1;
    return acc;
  }, {});

const buildFactorColumns = (selectedFactors, onToggle) => {
  const counts = countByFactorId(selectedFactors);
  return [
    {
      key: 'name',
      header: 'Factor',
      sortable: true,
      renderFn: (value, row) => (
        <div>
          <div className="text-[11px] font-medium text-white">{value}</div>
          <div className="text-[10px] text-gray-600 mt-0.5">{row.nameKo}</div>
        </div>
      ),
    },
    {
      key: 'sub',
      header: 'Category',
      width: 130,
      renderFn: (value, row) => <CatBadge category={row.category} sub={value} />,
    },
    {
      key: 'desc',
      header: 'Description',
      renderFn: (value) => (
        <span className="text-[11px] text-gray-400 leading-relaxed">{value}</span>
      ),
    },
    {
      key: 'examples',
      header: 'Indicators',
      renderFn: (value) => (
        <span className="text-[10px] text-gray-600">{value}</span>
      ),
    },
    {
      key: 'strategic',
      header: 'Strategic Use',
      renderFn: (value) => (
        <span className="text-[10px] text-gray-500 leading-relaxed">{value}</span>
      ),
    },
    {
      key: 'availability',
      header: 'Status',
      width: 90,
      renderFn: (value) => <AvailBadge status={value} />,
    },
    {
      key: '_toggle',
      header: '',
      width: 90,
      sortable: false,
      accessorFn: (row) => row.id,
      renderFn: (value, row) => {
        const n = counts[row.id] || 0;
        return (
          <button
            onClick={e => { e.stopPropagation(); onToggle(row); }}
            className="text-[10px] font-medium px-2.5 py-1 rounded border transition-colors text-cyan-400 border-cyan-800/50 bg-cyan-900/10 hover:bg-cyan-900/20"
          >
            {n > 0 ? `+ Add (${n})` : '+ Add'}
          </button>
        );
      },
    },
  ];
};

// ── Main Component ────────────────────────────────────────────────────────────

const StrategyBuilderDashboard = () => {
  const navigate = useNavigate();

  const [activeTab,   setActiveTab]   = useState('all');
  const [strategies,  setStrategies]  = useState([]);
  const [currentId,   setCurrentId]   = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [saving,      setSaving]      = useState(false);

  // Strategy state
  const [selectedFactors, setSelectedFactors] = useState([]);
  const [name,            setName]            = useState('');
  const [buyConditions,   setBuyConditions]   = useState([]);
  const [sellConditions,  setSellConditions]  = useState([]);
  const [buyLogic,        setBuyLogic]        = useState('AND');
  const [sellLogic,       setSellLogic]       = useState('OR');
  const [stopLoss,        setStopLoss]        = useState(5);
  const [takeProfit,      setTakeProfit]      = useState(15);
  const [capital,         setCapital]         = useState(10000);
  const [notes,           setNotes]           = useState('');

  const selectedIds = useMemo(
    () => new Set(selectedFactors.map(f => f.factorId)),
    [selectedFactors],
  );

  const varOptions = useMemo(() => buildVarOptions(selectedFactors), [selectedFactors]);

  // ── Load strategies ──────────────────────────────────────────────────────────
  const loadStrategies = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await quantAPI.listStrategies();
      setStrategies(res.data || []);
    } catch { /* no-op */ } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { loadStrategies(); }, [loadStrategies]);

  // ── Load strategy into editor ─────────────────────────────────────────────
  const loadStrategy = (strategy) => {
    setCurrentId(strategy.id);
    setName(strategy.name || '');
    setNotes(strategy.notes || '');

    const p = parseParams(strategy.parameters);
    setStopLoss(p.stop_loss_pct ?? 5);
    setTakeProfit(p.take_profit_pct ?? 15);
    setCapital(p.initial_capital ?? 10000);
    setBuyLogic(p.buy_logic  || 'AND');
    setSellLogic(p.sell_logic || 'OR');

    let vars = [];
    try {
      const parsed = JSON.parse(strategy.variables || '[]');
      vars = Array.isArray(parsed) ? parsed : [];
    } catch { vars = []; }
    setSelectedFactors(vars);

    // Build varOptions immediately from the loaded vars so that fromBECond can
    // map {factor, params} → the correct UI key (leftKey / rightKey).
    // This avoids the timing issue of waiting for React to re-memoize varOptions.
    const loadedVarOpts = buildVarOptions(vars);
    setBuyConditions((p.buy_conditions  || []).map(c => fromBECond(c, loadedVarOpts)));
    setSellConditions((p.sell_conditions || []).map(c => fromBECond(c, loadedVarOpts)));

    setActiveTab('strategy');
  };

  const clearEditor = () => {
    setCurrentId(null);
    setName('');
    setBuyConditions([]);
    setSellConditions([]);
    setBuyLogic('AND');
    setSellLogic('OR');
    setNotes('');
    setStopLoss(5);
    setTakeProfit(15);
    setCapital(10000);
    setSelectedFactors([]);
  };

  // ── Toggle factor ─────────────────────────────────────────────────────────
  // Always ADDS a new instance. Removal is done via the × button in AddedFactorRow.
  // When the same factorId is added again, a numeric suffix is appended to varName
  // (e.g. ema → ema2 → ema3) so each instance has a unique key in varOptions.
  const handleToggleFactor = useCallback((factor) => {
    setSelectedFactors(prev => {
      const existingCount = prev.filter(f => f.factorId === factor.id).length;
      const baseName = makeVarName(factor);
      const varName  = existingCount === 0 ? baseName : `${baseName}${existingCount + 1}`;
      const params   = {};
      factor.params.forEach(p => { params[p.name] = p.default; });
      const suffix = existingCount > 0 ? ` (${existingCount + 1}번째)` : '';
      toast(`"${factor.name}"${suffix} 추가됨 → My Strategy 탭에서 조건을 설정하세요`, {
        icon: '→',
        duration: 2500,
        style: { fontSize: '12px' },
      });
      return [...prev, { factorId: factor.id, varName, params }];
    });
  }, []);

  // Use varName as the unique key so two factors with the same factorId
  // (e.g. ema + ema2) can be updated / removed independently.
  const handleUpdateFactor = (varName, upd) => {
    setSelectedFactors(prev => prev.map(f => f.varName === varName ? upd : f));
  };

  const handleRemoveFactor = (varName) => {
    setSelectedFactors(prev => prev.filter(f => f.varName !== varName));
  };

  // ── Condition handlers ────────────────────────────────────────────────────
  const onAddBuy  = () => setBuyConditions(p => [...p, mkCondRow()]);
  const onAddSell = () => setSellConditions(p => [...p, mkCondRow()]);

  const onChangeBuy  = (i, upd) => setBuyConditions(p => p.map((r, idx) => idx === i ? upd : r));
  const onChangeSell = (i, upd) => setSellConditions(p => p.map((r, idx) => idx === i ? upd : r));

  const onRemoveBuy  = (i) => setBuyConditions(p => p.filter((_, idx) => idx !== i));
  const onRemoveSell = (i) => setSellConditions(p => p.filter((_, idx) => idx !== i));

  // ── Save ──────────────────────────────────────────────────────────────────
  const buildPayload = () => {
    const buy_conditions  = buyConditions.map(r => toBECond(r, varOptions));
    const sell_conditions = sellConditions.map(r => toBECond(r, varOptions));
    return {
      name:           name.trim(),
      strategy_type:  'custom',
      buy_condition:  buy_conditions.map(c =>
        `${c.left.factor} ${c.op} ${c.right.factor ?? c.right.value}`
      ).join(` ${buyLogic} `),
      sell_condition: sell_conditions.map(c =>
        `${c.left.factor} ${c.op} ${c.right.factor ?? c.right.value}`
      ).join(` ${sellLogic} `),
      formula:   '',
      variables: JSON.stringify(selectedFactors),
      parameters: JSON.stringify({
        stop_loss_pct:   stopLoss,
        take_profit_pct: takeProfit,
        initial_capital: capital,
        factor_ids:      selectedFactors.map(f => f.factorId),
        buy_conditions,
        sell_conditions,
        buy_logic:  buyLogic,
        sell_logic: sellLogic,
      }),
      notes,
    };
  };

  const handleSave = async (forceNew = false) => {
    if (!name.trim()) {
      toast.error('전략 이름을 입력하세요');
      setActiveTab('strategy');
      return;
    }
    if (buyConditions.length === 0) {
      toast.error('매수 조건을 하나 이상 추가하세요');
      setActiveTab('strategy');
      return;
    }
    setSaving(true);
    try {
      if (currentId && !forceNew) {
        await quantAPI.updateStrategy(currentId, buildPayload());
        toast.success('저장됐습니다');
      } else {
        const res = await quantAPI.createStrategy(buildPayload());
        setCurrentId(res.data?.id || null);
        toast.success('전략이 생성됐습니다');
      }
      loadStrategies();
    } catch (err) {
      toast.error(err.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNew = () => handleSave(true);

  const handleDelete = async (id) => {
    if (!window.confirm('전략을 삭제하시겠습니까?')) return;
    try {
      await quantAPI.deleteStrategy(id);
      if (currentId === id) clearEditor();
      toast.success('삭제됐습니다');
      loadStrategies();
    } catch (err) {
      toast.error(err.message || '삭제 실패');
    }
  };

  // ── Factor data ───────────────────────────────────────────────────────────
  const filteredFactors = useMemo(() => {
    const cat = TAB_CATEGORY_MAP[activeTab];
    const base = cat
      ? STRATEGY_FACTORS.filter(f => f.category === cat)
      : STRATEGY_FACTORS;
    return base.map(f => ({ ...f, _key: f.id }));
  }, [activeTab]);

  const columns = useMemo(
    () => buildFactorColumns(selectedFactors, handleToggleFactor),
    [selectedFactors, handleToggleFactor],
  );

  const addedCount = selectedFactors.length;

  return (
    <div className="flex flex-col bg-[#0a0a0f] overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-[#0d0d12] shrink-0">

        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <FlaskConical size={14} className="text-cyan-400" />
            <span className="font-semibold text-white text-sm">Strategy Builder</span>
          </div>

          <div className="w-px h-4 bg-gray-800 shrink-0" />

          <StrategyDropdown
            strategies={strategies}
            currentId={currentId}
            onLoad={loadStrategy}
            onDelete={handleDelete}
          />

          <button
            onClick={() => { clearEditor(); setActiveTab('strategy'); }}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-cyan-400 border border-cyan-800/50 bg-cyan-900/10 hover:bg-cyan-900/20 rounded transition-colors shrink-0"
          >
            <Plus size={11} /> New
          </button>

          {loadingList && (
            <div className="w-3.5 h-3.5 border border-cyan-500 border-t-transparent rounded-full animate-spin shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {addedCount > 0 && (
            <span className="text-[10px] text-gray-500 tabular-nums">
              {addedCount} factor{addedCount > 1 ? 's' : ''} selected
            </span>
          )}

          <button
            onClick={loadStrategies}
            className="p-1.5 rounded text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={13} />
          </button>

          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-xs font-semibold rounded transition-colors"
          >
            <Save size={12} />
            {saving ? 'Saving…' : 'Save'}
          </button>

          <button
            onClick={() => navigate('/quant')}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 text-xs rounded transition-colors"
          >
            <Play size={12} className="text-cyan-400" />
            Run in Quant
            <ExternalLink size={10} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* ── Category tabs ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800 bg-[#0d0d12] shrink-0">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded transition-colors ${
              activeTab === id
                ? 'text-cyan-400 bg-cyan-400/10'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {label}
          </button>
        ))}

        <div className="w-px h-4 bg-gray-800 mx-1" />

        {/* My Strategy tab */}
        <button
          onClick={() => setActiveTab('strategy')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded transition-colors ${
            activeTab === 'strategy'
              ? 'text-white bg-cyan-600/20 border border-cyan-700/50'
              : 'text-gray-300 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Settings size={11} />
          My Strategy
          {addedCount > 0 && (
            <span className="text-[9px] bg-cyan-900/60 text-cyan-300 border border-cyan-800/50 px-1.5 py-0.5 rounded-full tabular-nums leading-none">
              {addedCount}변수
            </span>
          )}
          {(buyConditions.length + sellConditions.length) > 0 && (
            <span className="text-[9px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full tabular-nums leading-none">
              {buyConditions.length + sellConditions.length}조건
            </span>
          )}
        </button>

        {/* Sub-categories */}
        {activeTab !== 'strategy' && activeTab !== 'all' && (
          <div className="ml-auto flex items-center gap-1.5">
            {(CATEGORY_META[TAB_CATEGORY_MAP[activeTab]]?.subs || []).map(sub => (
              <span key={sub} className="text-[10px] text-gray-600 px-2 py-0.5 bg-gray-800/40 rounded">
                {sub}
              </span>
            ))}
          </div>
        )}

        {activeTab === 'all' && (
          <span className="ml-auto text-[10px] text-gray-700 tabular-nums">
            {STRATEGY_FACTORS.length} factors
          </span>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">

        {activeTab !== 'strategy' && (
          <div className="h-full overflow-auto">
            <CommonTable
              columns={columns}
              data={filteredFactors}
              compact
              searchable={false}
              exportable={false}
              pageSize={50}
              rowClassName={r =>
                selectedIds.has(r.id)
                  ? 'bg-cyan-900/[0.07] border-l-2 border-l-cyan-600/50'
                  : 'border-l-2 border-l-transparent'
              }
            />
          </div>
        )}

        {activeTab === 'strategy' && (
          <StrategyEditorTab
            selectedFactors={selectedFactors}
            onUpdateFactor={handleUpdateFactor}
            onRemoveFactor={handleRemoveFactor}
            name={name}             setName={setName}
            buyConditions={buyConditions}   sellConditions={sellConditions}
            buyLogic={buyLogic}             sellLogic={sellLogic}
            onAddBuy={onAddBuy}             onAddSell={onAddSell}
            onChangeBuy={onChangeBuy}       onChangeSell={onChangeSell}
            onRemoveBuy={onRemoveBuy}       onRemoveSell={onRemoveSell}
            onBuyLogicChange={setBuyLogic}  onSellLogicChange={setSellLogic}
            varOptions={varOptions}
            stopLoss={stopLoss}     setStopLoss={setStopLoss}
            takeProfit={takeProfit} setTakeProfit={setTakeProfit}
            capital={capital}       setCapital={setCapital}
            notes={notes}           setNotes={setNotes}
            onSave={() => handleSave()}
            onSaveNew={handleSaveNew}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
};

export default StrategyBuilderDashboard;
