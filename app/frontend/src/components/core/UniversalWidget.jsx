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
 */
import { useState, useEffect, useCallback } from 'react';
import BaseWidget from '../widgets/common/BaseWidget';
import CommonTable from '../common/CommonTable';
import CommonChart  from '../common/CommonChart';
import { API_BASE } from '../../config/api';
import { UNIVERSAL_WIDGET_CONFIGS } from '../../registry/widgetConfigs';

/**
 * 응답 객체에서 dataPath를 따라 배열을 꺼낸다.
 *
 * dataPath 예시:
 *   'items'             → response.items
 *   'result.data'       → response.result.data
 *   ['history', 'data'] → response.history || response.data (순서대로 시도)
 */
function extractData(response, dataPath) {
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
  onRemove,
}) {
  const cfg = configOverride || UNIVERSAL_WIDGET_CONFIGS[widgetId];

  // 알 수 없는 widgetId
  if (!cfg) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 text-xs p-4">
        Unknown widget: <code className="ml-1 font-mono">{widgetId}</code>
      </div>
    );
  }

  const [symbol,   setSymbol]   = useState(symbolProp || cfg.defaultSymbol || 'AAPL');
  const [period,   setPeriod]   = useState(cfg.defaultPeriod  || '1y');
  const [viewMode, setViewMode] = useState(
    cfg.displayType === 'both' ? 'chart' : cfg.displayType
  );
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // symbolProp이 부모에서 바뀌면 동기화
  useEffect(() => {
    if (symbolProp) setSymbol(symbolProp);
  }, [symbolProp]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = cfg.endpoint
        .replace('{symbol}', symbol)
        .replace('{period}', period);

      const res = await fetch(`${API_BASE}${url}`);
      if (!res.ok) {
        setData([]);
        setError(`HTTP ${res.status}`);
        return;
      }
      const result = await res.json();
      setData(extractData(result, cfg.dataPath));
    } catch (e) {
      console.error(`UniversalWidget[${widgetId}] fetch error:`, e);
      setData([]);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [symbol, period, cfg.endpoint, cfg.dataPath, widgetId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 표시 모드 결정
  const canToggle = cfg.displayType === 'both';
  const showChart = viewMode === 'chart' && cfg.chartConfig;
  const showTable = viewMode === 'table' || (!showChart);

  return (
    <BaseWidget
      title={cfg.title}
      icon={cfg.icon}
      iconColor={cfg.iconColor}
      loading={loading}
      onRefresh={fetchData}
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
      ) : showChart ? (
        <CommonChart
          data={data}
          fillContainer
          {...cfg.chartConfig}
        />
      ) : (
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
