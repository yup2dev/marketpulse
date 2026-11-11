/**
 * UserWidget — 설정 화면에서 만든 사용자 정의 위젯 (type `user/{widget_id}`).
 *
 * 정의(store) + API 스키마를 UniversalWidget config 로 바꿔 넘길 뿐이다 — 그리는 일은
 * 전부 UniversalWidget 이 한다. 설정에서 정의를 고치면 store 가 바뀌고 이 위젯도 다시 그려진다.
 */
import { useEffect, useMemo, useState } from 'react';
import UniversalWidget from './UniversalWidget';
import BaseWidget from '../widgets/common/BaseWidget';
import { schemaAPI } from '../../config/api';
import useUserWidgetStore from '../../store/userWidgetStore';
import { toWidgetConfig, USER_WIDGET_PREFIX } from '../../registry/userWidgets';

/** (provider, model) 스키마. 못 받아도 위젯은 그린다 (사용자 입력칸이 텍스트로 나올 뿐). */
function useModelSchema(provider, model) {
  const [state, setState] = useState({ key: null, schema: null });
  const key = provider && model ? `${provider}/${model}` : null;
  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    schemaAPI.get(provider, model)
      .then((schema) => { if (alive) setState({ key, schema }); })
      .catch(() => { if (alive) setState({ key, schema: {} }); });
    return () => { alive = false; };
  }, [key, provider, model]);
  return state.key === key ? state.schema : null;
}

export default function UserWidget({ widgetId, symbol, portfolioId, onRemove }) {
  const id = widgetId.slice(USER_WIDGET_PREFIX.length);
  const loaded = useUserWidgetStore((s) => s.loaded);
  const def = useUserWidgetStore((s) => s.widgets.find((w) => w.widget_id === id));
  const load = useUserWidgetStore((s) => s.load);
  useEffect(() => { load(); }, [load]);

  const schema = useModelSchema(def?.provider, def?.model);
  const config = useMemo(() => (def && schema ? toWidgetConfig(def, schema) : null), [def, schema]);

  if (!loaded || (def && !config)) {
    return <BaseWidget title={def?.name || 'My widget'} loading onRemove={onRemove} source={def?.provider || 'user'} />;
  }
  if (!def) {
    return (
      <BaseWidget
        title="My widget"
        onRemove={onRemove}
        source="user"
        state={{
          kind: 'error',
          title: 'Widget definition not found',
          message: 'It was deleted in Settings. Remove this widget from the screen.',
        }}
      />
    );
  }

  // 정의가 바뀌면(updated_at) 새로 mount 한다 — UniversalWidget 은 파라미터 기본값을 처음 한 번만 읽는다
  return (
    <UniversalWidget
      key={def.updated_at || id}
      widgetId={widgetId}
      config={config}
      symbol={symbol || 'AAPL'}
      portfolioId={portfolioId}
      onRemove={onRemove}
    />
  );
}
