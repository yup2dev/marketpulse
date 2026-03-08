/**
 * UniversalWidget — config-driven widget renderer.
 *
 * UNIVERSAL_WIDGET_CONFIGS 테이블의 widgetId 항목을 읽어서
 * BaseWidget + CommonTable 또는 CommonChart를 자동으로 렌더링한다.
 *
 * 새 위젯 추가: src/registry/widgetConfigs.jsx 에 항목 1개만 추가하면 끝.
 *
 * Props:
 *   widgetId  - UNIVERSAL_WIDGET_CONFIGS의 키
 *   config    - (optional) widgetConfigs를 직접 덮어쓸 config 객체
 *   symbol    - 초기 심볼 (requiresSymbol=true인 위젯)
 *   onRemove  - 위젯 제거 핸들러
 *
 * Tier 지원:
 *   Tier 1 — 순수 config (chartConfig + columns)
 *   Tier 2 — renderBody(data, state) 함수로 커스텀 렌더
 *   Tier 3 — component: SomeComponent (fetch 없이 컴포넌트 직접 렌더)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import BaseWidget from '../widgets/common/BaseWidget';
import CommonTable from '../common/CommonTable';
import CommonChart  from '../common/CommonChart';
import { apiClient, API_BASE } from '../../config/api';
import { UNIVERSAL_WIDGET_CONFIGS } from '../../registry/widgetConfigs';

/**
 * 응답 객체에서 dataPath를 따라 배열을 꺼낸다.
 *
 * dataPath 예시:
 *   'items'             → response.items
 *   'result.data'       → response.result.data
 *   ['history', 'data'] → response.history || response.data (순서대로 시도)
 *   null                → response 자체를 반환 (배열이 아니어도)
 */
function extractData(response, dataPath) {
  if (dataPath === null) return response;
  if (Array.isArray(response)) return response;

  const paths = Array.isArray(dataPath) ? dataPath : [dataPath];

  for (const path of paths) {
    if (!path) continue;
    const value = path.split('.').reduce((obj, key) => obj?.[key], response);
    if (Array.isArray(value)) return value;
  }

  return [];
}

export default function UniversalWidget({
  widgetId,
  config: configOverride,
  symbol: symbolProp,
  portfolioId: portfolioIdProp,
  onRemove,
}) {
  const cfg = configOverride || UNIVERSAL_WIDGET_CONFIGS[widgetId];

  // ── State (모든 hooks는 조건문 전에 선언) ──────────────────────────────────
  const rawDataRef = useRef(null);
  const [symbol,     setSymbol]     = useState(symbolProp || cfg?.defaultSymbol || 'AAPL');
  const [period,     setPeriod]     = useState(cfg?.defaultPeriod  || '1y');
  const [viewMode,   setViewMode]   = useState(
    cfg?.displayType === 'both' ? 'chart' : (cfg?.displayType || 'table')
  );
  const [activeView, setActiveView] = useState(cfg?.views?.[0] ?? null);
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(!!(cfg?.endpoint));
  const [error,   setError]   = useState(null);

  // symbolProp이 부모에서 바뀌면 동기화
  useEffect(() => {
    if (symbolProp) setSymbol(symbolProp);
  }, [symbolProp]);

  const fetchData = useCallback(async () => {
    if (!cfg?.endpoint) return;
    setLoading(true);
    setError(null);
    try {
      const url = cfg.endpoint
        .replace('{symbol}', symbol)
        .replace('{period}', period)
        .replace('{portfolioId}', portfolioIdProp || '');

      const result = await apiClient.get(`${API_BASE}${url}`);
      rawDataRef.current = result;
      if (cfg.dataTransform) {
        // dataTransform: (rawResponse) => rows[] — JSX 없이 데이터 매핑
        setData(cfg.dataTransform(result));
      } else {
        setData(cfg.dataPath !== undefined
          ? extractData(result, cfg.dataPath)
          : extractData(result, null)
        );
      }
    } catch (e) {
      console.error(`UniversalWidget[${widgetId}] fetch error:`, e);
      setData([]);
      setError(e.message || `HTTP ${e.status || 'error'}`);
    } finally {
      setLoading(false);
    }
  }, [symbol, period, portfolioIdProp, cfg?.endpoint, cfg?.dataPath, widgetId]);

  useEffect(() => {
    if (cfg?.endpoint) fetchData();
  }, [fetchData]);

  // ── 알 수 없는 widgetId ───────────────────────────────────────────────────
  if (!cfg) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 text-xs p-4">
        Unknown widget: <code className="ml-1 font-mono">{widgetId}</code>
      </div>
    );
  }

  // ── Tier 3: fullWidget component ──────────────────────────────────────────
  if (cfg.component) {
    const Comp = cfg.component;
    return <Comp symbol={symbolProp} onRemove={onRemove} />;
  }

  // ── 표시 모드 결정 ─────────────────────────────────────────────────────────
  const canToggle = cfg.displayType === 'both';
  const showChart = viewMode === 'chart' && cfg.chartConfig;

  return (
    <BaseWidget
      title={cfg.title}
      icon={cfg.icon}
      iconColor={cfg.iconColor}
      loading={loading}
      onRefresh={cfg.endpoint ? fetchData : undefined}
      onRemove={onRemove}
      symbol={cfg.requiresSymbol ? symbol : undefined}
      onSymbolChange={cfg.requiresSymbol ? setSymbol : undefined}
      viewMode={viewMode}
      onViewModeChange={canToggle ? setViewMode : undefined}
      showViewToggle={canToggle}
      period={cfg.periodType ? period : undefined}
      onPeriodChange={cfg.periodType ? setPeriod : undefined}
      periodType={cfg.periodType || 'macro'}
      showPeriodSelector={!!cfg.periodType}
      source={cfg.source}
      syncable={cfg.syncable || false}
    >
      {error ? (
        <div className="flex items-center justify-center h-full text-red-400 text-xs p-4">
          {error}
        </div>
      ) : cfg.renderBody ? (
        // ── Tier 2: renderBody 위임 ─────────────────────────────────────────
        cfg.renderBody(data, {
          rawData: rawDataRef.current,
          viewMode,
          setViewMode,
          activeView,
          setActiveView,
          period,
          symbol,
        })
      ) : showChart ? (
        // ── Tier 1: CommonChart ────────────────────────────────────────────
        <CommonChart
          data={data}
          fillContainer
          {...cfg.chartConfig}
        />
      ) : (
        // ── Tier 1: CommonTable ────────────────────────────────────────────
        <CommonTable
          columns={cfg.columns || []}
          data={data}
          emptyMessage="No data available"
          {...(cfg.tableOptions || {})}
        />
      )}
    </BaseWidget>
  );
}
