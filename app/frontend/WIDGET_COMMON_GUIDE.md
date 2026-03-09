# Widget 공통화 가이드

> **목적**: OpenBB `frontend-components` 분석을 바탕으로 MarketPulse 위젯 레이어의
> 현재 구조를 문서화하고, 중복 제거·공통화 적용 방향을 정리한다.
>
> 작성일: 2026-03-09

---

## 1. OpenBB 분석 요약

### 1-1. 구조

OpenBB `frontend-components`는 **독립 Vite 프로젝트 두 개**로 구성된다.

```
frontend-components/
├── plotly/src/          ← Plotly.js 차트 위젯
│   ├── App.tsx
│   ├── components/
│   │   ├── Chart.tsx    (906 LOC)
│   │   ├── Dialogs/
│   │   └── Icons/       ← 아이콘 5개 (중복)
│   └── utils/
│       ├── useClickOutside.tsx  ← 미사용 (중복)
│       └── utils.ts             ← non_blocking 단독 파일
└── tables/src/          ← TanStack Table 위젯
    ├── App.tsx
    ├── components/
    │   ├── Table/
    │   ├── Toast.tsx
    │   └── Icons/       ← 아이콘 5개 (중복)
    └── utils/
        ├── useClickOutside.tsx  ← 사용됨 (중복)
        ├── useDarkMode.tsx
        ├── useLocalStorage.tsx
        └── utils.ts             ← non_blocking + 테이블 전용
```

### 1-2. 데이터 출력 방식

두 위젯 모두 동일한 **window 폴링 패턴**을 사용한다.

```js
// plotly/App.tsx & tables/App.tsx — 90% 동일
useEffect(() => {
  if (process.env.NODE_ENV === "production") {
    const interval = setInterval(() => {
      if (window.json_data) {
        const data = /* plotly: 그대로 / tables: JSON.parse */ window.json_data;
        setData(data);
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }
}, []);
```

데이터 수신 후 각자의 `transformData()`로 정규화 → 전용 컴포넌트(`<Chart>` / `<Table>`)에 전달한다.

### 1-3. 확인된 중복 목록

| 파일 | plotly | tables | 중복도 |
|------|:------:|:------:|:------:|
| `Icons/Close.tsx` | ✓ | ✓ | 100% |
| `Icons/CloseCircle.tsx` | ✓ (미사용) | ✓ | 100% |
| `Icons/Info.tsx` | ✓ (미사용) | ✓ | 100% |
| `Icons/Success.tsx` | ✓ (미사용) | ✓ | 100% |
| `Icons/Warning.tsx` | ✓ (미사용) | ✓ | 100% |
| `utils/useClickOutside.tsx` | ✓ (미사용) | ✓ | 100% |
| `utils/utils.ts` → `non_blocking` | ✓ | ✓ | 100% |
| `App.tsx` 폴링 패턴 | ✓ | ✓ | 90% |

### 1-4. OpenBB가 취한 방식의 한계

- 두 Vite 프로젝트가 **tsconfig `include`와 별칭 없이** 각자 구성되어
  공유 경로(`@shared/`)를 사용하지 않는다.
- 결과적으로 동일 코드가 각 모듈에 복사되어 유지보수 분기가 발생한다.

---

## 2. MarketPulse 현재 구조

### 2-1. 디렉토리 맵

```
src/
├── App.jsx
├── main.jsx
│
├── components/
│   ├── common/               ← 재사용 UI 원자
│   │   ├── CommonChart.jsx
│   │   ├── CommonTable.jsx
│   │   ├── WidgetHeader.jsx
│   │   ├── WidgetContextMenu.jsx
│   │   ├── StockSelector.jsx
│   │   ├── SymbolAutocomplete.jsx
│   │   ├── DateRangePicker.jsx
│   │   ├── BenchmarkSelector.jsx
│   │   ├── ChartTypeSelector.jsx
│   │   ├── RebalancingSelector.jsx
│   │   ├── TickerSearch.jsx
│   │   ├── Header.jsx
│   │   ├── MenuDropdown.jsx
│   │   ├── GlobalLoadingOverlay.jsx
│   │   ├── ErrorBoundary.jsx
│   │   ├── ProtectedRoute.jsx
│   │   └── ThemeToggle.jsx
│   │
│   ├── core/                 ← 위젯 프레임워크 (핵심)
│   │   ├── UniversalWidget.jsx   ← config-driven 위젯 진입점
│   │   ├── WidgetRenderer.jsx    ← 위젯 type → 컴포넌트 라우팅
│   │   ├── DashboardGrid.jsx     ← react-grid-layout 래퍼
│   │   ├── DashboardPage.jsx     ← 페이지 레벨
│   │   ├── PlotlyChart.jsx
│   │   ├── WidgetContainer.jsx
│   │   ├── WidgetMenu.jsx
│   │   └── widgetPatterns.jsx    ← 재사용 렌더 패턴 (Tier 2)
│   │
│   ├── widgets/
│   │   ├── ChartWidget.jsx
│   │   ├── constants.jsx
│   │   └── common/
│   │       ├── BaseWidget.jsx    ← 모든 위젯의 껍데기
│   │       └── WidgetHeader.jsx  ← ⚠ common/WidgetHeader와 동명
│   │
│   ├── trading/
│   │   ├── TradingTerminal.jsx
│   │   ├── hooks/            ← trading 전용 hooks
│   │   ├── panels/           ← 패널 컴포넌트
│   │   └── widgets/          ← trading 전용 위젯
│   │
│   ├── portfolio/ backtest/ screener/ strategy/ quant/ watchlist/ alerts/ auth/ layout/
│   │   └── (도메인 컴포넌트)
│
├── registry/
│   ├── widgetConfigs.jsx     ← UNIVERSAL_WIDGET_CONFIGS (Tier 1/2 config)
│   └── urlWidgetMap.js
│
├── hooks/                    ← 전역 hooks
│   ├── useApi.js
│   ├── useWorkspace.js
│   ├── usePortfolioState.js
│   ├── useTheme.js
│   ├── useAlerts.js
│   ├── useMenus.js
│   ├── useChartZoom.js
│   ├── usePairAnalysis.js
│   └── useTechnicalIndicators.js
│
├── store/                    ← Zustand stores
│   ├── authStore.js
│   ├── workspaceStore.js
│   ├── themeStore.js
│   └── navigationStore.js
│
├── contexts/                 ← React Context
│   ├── WidgetSyncContext.jsx
│   ├── GlobalWidgetContext.jsx
│   ├── LoadingContext.jsx
│   └── AlertsContext.jsx
│
├── utils/
│   ├── exportUtils.js
│   ├── themeUtils.js
│   ├── pairAnalysis.js
│   └── technicalIndicators.js
│
├── config/
│   └── api.js
│
└── data/
    └── strategyFactors.js
```

### 2-2. 위젯 데이터 흐름

```
widgetConfigs.jsx (config)
        │
        ▼
WidgetRenderer.jsx
  ├── portfolio-* case   → PortfolioXxxWidget (props from portfolioData)
  └── default            → UniversalWidget
                                │
                  ┌─────────────┼──────────────┐
                  ▼             ▼               ▼
              Tier 3        Tier 2          Tier 1
           cfg.component  cfg.renderBody   cfg.columns
                │             │            cfg.chartConfig
                ▼             ▼               ▼
          <SomeComponent>  CommonTable/   CommonTable
                          CommonChart    CommonChart
                                │
                          BaseWidget (껍데기)
```

**API 호출 위치**: `UniversalWidget.fetchData` (내부 useCallback + useEffect)

---

## 3. 현재 문제점 (중복·분산)

### 3-1. WidgetHeader 이중 존재

```
src/components/common/WidgetHeader.jsx       ← 공통 헤더?
src/components/widgets/common/WidgetHeader.jsx  ← BaseWidget 내부 헤더?
```

→ BaseWidget이 이미 헤더를 내장하므로 `widgets/common/WidgetHeader.jsx`의
  존재 이유를 확인하고 병합 또는 삭제 필요.

### 3-2. 통화 포맷 함수 산재

`WidgetRenderer.jsx` 안에 다음 지역 상수들이 반복 정의된다.

```js
const _fmtUSDBal  = (val) => new Intl.NumberFormat('en-US', { style: 'currency', ... })
const _fmtUSDPos  = (val) => new Intl.NumberFormat('en-US', { style: 'currency', ... })
const _fmtTxn     = (val) => new Intl.NumberFormat('en-US', { style: 'currency', ... })
const _fmtKRWLocal = (val) => new Intl.NumberFormat('ko-KR', { style: 'currency', ... })
```

`usePortfolioState.js`에 이미 `formatCurrency` / `formatKRW`가 있음에도
파일마다 다른 이름으로 재정의되어 있다.

### 3-3. mousedown 외부클릭 패턴 반복

`BaseWidget.jsx`, `WidgetRenderer.jsx`, 여러 도메인 컴포넌트에서
동일한 패턴이 인라인으로 반복된다.

```js
useEffect(() => {
  const handler = (e) => {
    if (ref.current && !ref.current.contains(e.target)) close();
  };
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, []);
```

### 3-4. PortfolioXxx 위젯이 WidgetRenderer에 인라인

`WidgetRenderer.jsx`가 1,022 LOC로 비대하다.
Portfolio 위젯 5개(Stats, PnLChart, Holdings, Balances, Positions, TradeHistory)가
모두 이 파일 안에 정의되어 있다.

### 3-5. 포맷 헬퍼가 widgetConfigs에도 중복 정의

`widgetConfigs.jsx`에 `posNeg`, `gray`, `fmtDate`, `fmtMagnitude`, `fmtNum` 등
포맷 함수가 모듈 상단에 모여 있고, 동일 로직이 `WidgetRenderer.jsx`와
`utils/exportUtils.js`에도 부분적으로 존재한다.

---

## 4. 공통화 가이드

### 4-1. 공통 hook 추출: `useClickOutside`

**현재**: BaseWidget, 여러 컴포넌트에서 인라인 반복
**목표**: `src/hooks/useClickOutside.js` 하나로 통일

```js
// src/hooks/useClickOutside.js
import { useEffect } from 'react';

export default function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      handler(e);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}
```

**적용 대상**
- `BaseWidget.jsx` (export menu outside-click)
- `BaseWidget.jsx` → `SymbolSelector` 내부 outside-click
- `WidgetRenderer.jsx` 내 드롭다운들
- 기타 드롭다운/모달 컴포넌트

---

### 4-2. 통화·숫자 포맷 유틸 통일

**현재**: `WidgetRenderer.jsx`에 `_fmtUSDBal`, `_fmtUSDPos`, `_fmtTxn` 등 별칭만 다른 동일 함수 반복
**목표**: `src/utils/formatUtils.js` 신설 (또는 `exportUtils.js`에 병합)

```js
// src/utils/formatUtils.js

export const fmtUSD = (val, decimals = 2) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val ?? 0);

export const fmtKRW = (val) =>
  new Intl.NumberFormat('ko-KR', {
    style: 'currency', currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(Math.round(val ?? 0));

export const fmtMagnitude = (value) => {
  if (value == null) return '-';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
};

export const fmtNum = (value) => {
  if (value == null) return '-';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString();
};

export const fmtPercent = (v, decimals = 2) =>
  v == null ? '-' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(decimals)}%`;

export const fmtDate = (s) => {
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
};
```

**정리 대상**
- `WidgetRenderer.jsx` 상단 지역 상수 `_fmtUSDBal`, `_fmtUSDPos`, `_fmtTxn`, `_fmtKRWLocal` → 삭제 후 `formatUtils` import
- `widgetConfigs.jsx` 상단 `fmtMagnitude`, `fmtNum`, `posNeg`, `fmtDate` → `formatUtils` import
- `usePortfolioState.js`의 `formatCurrency`, `formatKRW` → `formatUtils`로 이전 또는 re-export

---

### 4-3. PortfolioXxx 위젯 분리

**현재**: 6개 Portfolio 위젯이 `WidgetRenderer.jsx`(1,022 LOC) 안에 인라인 정의
**목표**: 각 위젯을 별도 파일로 분리하고 `WidgetRenderer`는 라우팅만 담당

```
src/components/widgets/portfolio/
├── PortfolioStatsWidget.jsx
├── PortfolioPnLChartWidget.jsx
├── PortfolioHoldingsWidget.jsx
├── PortfolioBalancesWidget.jsx
├── PortfolioPositionsWidget.jsx
└── PortfolioTradeHistoryWidget.jsx
```

`WidgetRenderer.jsx`는 각 파일을 import하고 switch-case만 유지 → **~200 LOC로 축소**.

---

### 4-4. WidgetHeader 정리

**현재**: 동명 파일 두 개
- `common/WidgetHeader.jsx`
- `widgets/common/WidgetHeader.jsx`

**확인 후 선택지**
1. `BaseWidget.jsx`가 헤더를 이미 내장 → `widgets/common/WidgetHeader.jsx` 사용처 없으면 삭제
2. 외부에서 헤더만 단독으로 쓰는 곳이 있다면 `common/WidgetHeader.jsx` 하나로 통일하고 나머지 삭제

---

### 4-5. widgetConfigs 포맷 헬퍼 이전

`widgetConfigs.jsx` 상단의 `posNeg`, `gray`, `fmtDate`, `fmtMagnitude`, `fmtNum`, `ChartBody` 등을
`formatUtils.js` 또는 `widgetPatterns.jsx`로 이전한다.

`widgetConfigs.jsx`는 **config 데이터 only** — 함수 정의 없이 import만 사용하는 형태가 목표.

---

### 4-6. WidgetRenderer의 위젯 데이터 파이프라인 공통화

OpenBB의 window 폴링 패턴처럼, MarketPulse도 `UniversalWidget.fetchData` 로직이
여러 곳에서 약간씩 다르게 재구현될 가능성이 있다.

**현재 흐름 (정상)**: `UniversalWidget` 내부 `fetchData` → 중앙화됨
**주의**: 아래 케이스들이 `UniversalWidget`을 우회하지 않는지 주기적으로 점검

- Trading 위젯: `useBinanceStreams`, `useStockIntraday` → 스트림 특성상 별도 정상
- Portfolio 위젯: `WidgetRenderer`에서 `portfolioData` props로 주입 → 정상 (별도 fetch 없음)
- `PlotlyChart.jsx`, `ChartWidget.jsx`: `UniversalWidget`을 통하지 않고 직접 fetch하는지 확인 필요

---

## 5. 우선순위 로드맵

| 순서 | 작업 | 영향도 | 난이도 |
|:----:|------|:------:|:------:|
| 1 | `formatUtils.js` 신설 + WidgetRenderer/widgetConfigs 포맷 함수 이전 | 높음 | 낮음 |
| 2 | `useClickOutside` hook 추출 | 중간 | 낮음 |
| 3 | PortfolioXxx 위젯 6개 → 별도 파일 분리 | 높음 | 낮음 |
| 4 | `WidgetHeader` 중복 정리 | 낮음 | 낮음 |
| 5 | `widgetConfigs.jsx` config-only 정리 | 중간 | 중간 |
| 6 | `PlotlyChart.jsx` / `ChartWidget.jsx` 데이터 fetch 경로 점검 | 중간 | 중간 |

---

## 6. 새 위젯 추가 표준 절차

OpenBB와 달리 MarketPulse는 이미 **3-Tier 위젯 시스템**이 구축되어 있다.
새 위젯은 아래 순서로만 추가한다.

### Tier 1 (순수 config — 권장)

`widgetConfigs.jsx`에 항목 1개 추가.
fetch URL + column 정의 + chartConfig만 작성하면 완성.

```js
'my-new-widget': {
  title: 'My Widget',
  icon: Activity,
  iconColor: 'text-cyan-400',
  endpoint: '/stock/{symbol}/my-data',
  dataPath: 'items',
  defaultSymbol: 'AAPL',
  requiresSymbol: true,
  periodType: 'short',
  source: 'My Data Source',
  columns: [
    { key: 'date',  header: 'Date' },
    { key: 'value', header: 'Value', align: 'right' },
  ],
},
```

### Tier 2 (커스텀 렌더)

config에 `renderBody(data, state)` 추가.
`widgetPatterns.jsx`의 `KVTable`, `TabBar`, `ProgressBarDisplay` 등을 활용한다.
**renderBody 안에서 JSX 정의는 최소화** — 재사용 패턴 우선.

### Tier 3 (완전 커스텀)

config에 `component: SomeComponent` 추가.
Trading 위젯, 복잡한 상호작용이 필요한 위젯만 해당.
`BaseWidget` + `CommonTable/CommonChart`를 내부에서 반드시 사용한다.

---

## 7. 공통 컴포넌트 사용 규칙

| 컴포넌트 | 사용 조건 | 사용 금지 |
|---------|---------|---------|
| `BaseWidget` | 모든 위젯의 최상위 래퍼 | 위젯 없이 단독 렌더 |
| `CommonTable` | 테이블 표시 전 영역 | 커스텀 `<table>` 직접 작성 |
| `CommonChart` | 차트 표시 전 영역 | Plotly/recharts 직접 호출 |
| `SymbolAutocomplete` | 심볼 검색 입력 | 인라인 `<input>` + fetch |
| `DateRangePicker` | 날짜 범위 선택 | 인라인 date input |
| `ErrorBoundary` | 페이지·섹션 경계 | 위젯 단위 중간 경계 불필요 |

---

*이 문서는 구현 진행에 따라 갱신한다.*
