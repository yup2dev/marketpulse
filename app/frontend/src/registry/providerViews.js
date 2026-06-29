/**
 * providerViews — (model, provider) 쌍별 위젯 body UI override 레지스트리.
 *
 * 표준모델 위젯은 provider를 바꿔도 데이터 소스만 갈아끼고 UI(table/chart/kv)는 동일하다.
 * 같은 model이라도 특정 provider에서는 데이터를 가공해 전용 UI로 보여주고 싶을 때,
 * 여기에 (model → provider → 컴포넌트)를 등록하면 UniversalWidget이 그 provider 선택 시
 * 기본 렌더러 대신 등록된 컴포넌트로 위젯 **body만** 교체한다.
 *
 * 키는 model(=category 키, 예: 'financials', 'holders', 'insider_trading')로 잡는다.
 *   - 레지스트리 위젯(widgetEndpoints의 category)과 동적 model/{model} 위젯 모두 category를
 *     UniversalWidget에 일관되게 넘기므로(UniversalWidget.jsx), model 단위 키잉 하나로
 *     같은 model을 쓰는 모든 위젯 타입에 전역 적용된다.
 *
 * override 컴포넌트 prop 계약 (UniversalWidget이 주입):
 *   {
 *     response,   // 선택 provider의 원본 API 응답 JSON(OBBject shape) — 커스텀 가공의 입력
 *     rows,       // UniversalWidget이 정규화한 행 배열(편의용)
 *     provider,   // 선택된 provider id (예: 'fmp')
 *     symbol,     // 현재 심볼
 *     period,     // 현재 기간
 *     loading,    // boolean
 *     error,      // string | null
 *   }
 *   - 컴포넌트는 **body만** 렌더(컨테이너를 채운다). title/provider 셀렉터/refresh 등
 *     header는 UniversalWidget이 그대로 소유한다.
 *   - override 활성 시 기본 view-toggle(table/chart)과 차트타입 셀렉터는 숨겨진다
 *     (override가 자체 레이아웃을 소유).
 *
 * 새 override 추가:
 *   1) ExampleProviderView.jsx를 복사해 전용 컴포넌트 작성.
 *   2) 아래 PROVIDER_VIEWS에 model → { providerId: Component } 등록.
 */

// model(category) → { providerId: BodyComponent }
export const PROVIDER_VIEWS = {
  // 예: financials: { fmp: FmpFinancialsView },
};

/**
 * 주어진 (model, provider)에 등록된 override 컴포넌트를 반환. 없으면 null.
 * @param {string|undefined} model    category(=model) 키
 * @param {string|undefined} provider  선택된 provider id
 * @returns {React.ComponentType|null}
 */
export function resolveProviderView(model, provider) {
  if (!model || !provider) return null;
  return PROVIDER_VIEWS[model]?.[provider] ?? null;
}
