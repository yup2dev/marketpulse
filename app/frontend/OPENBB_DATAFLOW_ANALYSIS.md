# OpenBB Frontend Data Flow 분석

> 분석 대상:
> - `C:\Users\TRIA\PycharmProjects\OpenBB\desktop\src`
> - `C:\Users\TRIA\PycharmProjects\OpenBB\frontend-components`
>
> 작성일: 2026-03-09

---

## 전체 아키텍처 개요

OpenBB 프론트엔드는 **두 개의 독립적인 레이어**로 구성된다.

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: Desktop App  (desktop/src)                            │
│  Tauri + TanStack Router                                        │
│  역할: 백엔드 서비스/환경/API키 관리 UI                           │
└────────────────────────────┬────────────────────────────────────┘
                             │ Tauri invoke / IPC
┌────────────────────────────▼────────────────────────────────────┐
│  LAYER 2: Widget Renderer  (frontend-components)                │
│  두 개의 독립 Vite 빌드                                           │
│  ┌──────────────────────┐   ┌──────────────────────────────┐   │
│  │  plotly/             │   │  tables/                     │   │
│  │  Plotly.js 차트 위젯  │   │  TanStack Table 데이터 테이블 │   │
│  └──────────────────────┘   └──────────────────────────────┘   │
│  역할: Python이 생성한 데이터를 시각화                             │
└─────────────────────────────────────────────────────────────────┘
```

두 레이어는 **완전히 독립**되어 있다. Desktop App은 Tauri IPC로 OS 기능을 사용하고,
Widget Renderer는 `window.json_data` 글로벌 변수 폴링으로 Python 데이터를 수신한다.

---

## LAYER 1: Desktop App

### 전체 데이터 흐름

```
Tauri Rust Backend
     │
     │  invoke("get_user_credentials")
     │  invoke("update_backend_service")
     │  invoke("create_environment")
     │  listen("environment_created")
     ▼
routes/ (React 페이지)
     │
     │  useState + useCallback + useEffect
     ▼
components/ (공통 UI 컴포넌트)
     │
     ▼
DOM 렌더링
```

---

### 파일별 분석

#### `main.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | React 앱 진입점 |
| **기술** | TanStack React Router v1 |
| **입력** | `routeTree.gen.ts` (자동 생성 라우트 트리) |
| **출력** | `RouterProvider` → 전체 라우팅 |

```typescript
const router = createRouter({ routeTree });
ReactDOM.createRoot(document.getElementById("root"))
  .render(<RouterProvider router={router} />);
```

---

#### `routes/__root.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 전역 레이아웃 + 탭 네비게이션 |
| **LOC** | 265줄 |
| **입력** | `EnvironmentCreationContext` 상태 |
| **출력** | 상단 탭 바 + `<Outlet />` (하위 라우트) |

**핵심 로직: 탭 네비게이션**
```typescript
// 환경 생성 중이면 탭 이동 비활성화
const { isCreatingEnvironment } = useEnvironmentCreationContext();

<nav>
  <Link to="/backends"    disabled={isCreatingEnvironment}>Backends</Link>
  <Link to="/environments" disabled={isCreatingEnvironment}>Environments</Link>
  <Link to="/api-keys"    disabled={isCreatingEnvironment}>API Keys</Link>
</nav>
```

**데이터 흐름**:
```
EnvironmentCreationContext
  → isCreatingEnvironment 상태
    → NavLink disabled 여부 결정
      → 탭 비활성화 (생성 중 이탈 방지)
```

---

#### `contexts/EnvironmentCreationContext.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 환경 생성 진행 상태 전역 관리 |
| **패턴** | React Context API |
| **공유 상태** | `isCreatingEnvironment: boolean` |

```typescript
// Provider → __root.tsx에서 감싸기
<EnvironmentCreationProvider>
  <RootLayout />
</EnvironmentCreationProvider>

// 소비 → environments.tsx에서 생성 시작/종료 신호
const { setIsCreatingEnvironment } = useEnvironmentCreationContext();
setIsCreatingEnvironment(true);   // 생성 시작
setIsCreatingEnvironment(false);  // 생성 완료
```

---

#### `routes/api-keys.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | API Key CRUD 페이지 |
| **LOC** | 1,138줄 |
| **Tauri API** | `invoke("get_user_credentials")`, `invoke("update_user_credentials")` |

**데이터 흐름 (4단계)**:

```
1. LOAD
   invoke("get_user_credentials")
   → UserCredentialsResult { credentials: Record<string,string> }
   → setApiKeys(formattedKeys)

2. EDIT
   <Modal> 입력
   → handleSaveKey()
   → invoke("update_user_credentials", { credentials })

3. IMPORT (JSON / .env 파일)
   <input type="file"> 선택
   → parseImportedFile(file)
     ├─ JSON: JSON.parse → Object.entries(jsonData.credentials)
     └─ .env: 라인별 regex match(/^([^=]+)=(.*)$/)
   → 임포트 확인 모달
   → handleConfirmImport()
   → invoke("update_user_credentials")

4. DISPLAY (검색 필터)
   apiKeys (전체)
   → useMemo: searchTerm으로 filter
   → filteredApiKeys → 테이블 렌더링
```

**상태 구조**:
```typescript
interface ApiKey {
  key: string;      // API 키 이름 (예: "OPENBB_API_KEY")
  value: string;    // 값
  required: boolean;
}

const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
const [searchTerm, setSearchTerm]  = useState('');
const [showValues, setShowValues]  = useState<Record<string, boolean>>({});
const [editingKey, setEditingKey]  = useState<ApiKey | null>(null);
const [isAddKeyModalOpen, ...]     = useState(false);
const [isImportModalOpen, ...]     = useState(false);
const [importedKeys, setImportedKeys] = useState<ApiKey[]>([]);
const [error, setError]            = useState<string | null>(null);
```

---

#### `routes/backends.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 백엔드 서비스 CRUD + 시작/중지 |
| **LOC** | 2,741줄 |
| **Tauri API** | `invoke("stop_backend_service")`, `invoke("update_backend_service")`, `invoke("generate_self_signed_cert")` |

**핵심 데이터 구조**:
```typescript
interface BackendService {
  id: string;
  name: string;
  command: string;   // 실행 명령어
  host?: string;
  port?: number;
  status: "running" | "stopped" | "starting" | "stopping" | "error";
  autoStart: boolean;
  error?: string;
}
```

**상태 흐름**:
```
invoke("get_backend_services") → services[]
  → BackendServiceItem 렌더링
    → [Start] 클릭 → invoke("start_backend_service")
    → [Stop]  클릭 → invoke("stop_backend_service")
    → 상태: stopped → starting → running
```

---

#### `routes/environments.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | Conda 환경 + 확장 프로그램 관리 |
| **LOC** | 3,408줄 |
| **특이점** | Tauri `listen()` 이벤트 수신, LocalStorage 캐시 |

**데이터 흐름**:
```
1. 환경 목록
   invoke("get_environments")
   → environments: Environment[]
   → 좌측 사이드바 렌더링

2. 확장 프로그램
   invoke("get_extensions", { envName })
   → extensions: Extension[]
   → 로컬스토리지 캐시 (ENV_EXTENSIONS_CACHE_KEY)
   → 우측 패널 렌더링

3. 환경 생성 (비동기 이벤트)
   setIsCreatingEnvironment(true)         ← Context 업데이트
   → invoke("create_environment", {...})
   → listen("environment_progress", handler)  ← Tauri 이벤트 수신
     → 진행률 UI 업데이트
   → 생성 완료 이벤트
   → setIsCreatingEnvironment(false)       ← Context 업데이트
```

**핵심 인터페이스**:
```typescript
interface Environment {
  name: string;
  pythonVersion: string;
  path: string;
}

interface Extension {
  package: string;
  version: string;
  install_method: "pip" | "conda";
  channel: string;
}
```

---

#### `components/Toast.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 에러/알림 토스트 UI |
| **의존성** | `@openbb/ui-pro` Button 컴포넌트 |
| **LOC** | 55줄 |

```typescript
// Props
interface ToastProps {
  title: string;
  children?: ReactNode;
  onClose: () => void;
  buttonText?: string;
  onButtonClick?: () => void;
}

// 사용처: api-keys.tsx, backends.tsx, environments.tsx
setError("연결에 실패했습니다");
// → <Toast title="Error">{error}</Toast>
```

---

#### `components/Icon.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | SVG 아이콘 + 브랜드 로고 |
| **방식** | SVG 스프라이트 시트 참조 (`/assets/icons/sprite.svg#id`) |

```typescript
// SVG 스프라이트 방식 (런타임 로드)
const CustomIcon = ({ id, className }) => (
  <svg viewBox="0 0 24 24">
    <use href={`/assets/icons/sprite.svg#${id}`} />
  </svg>
);

// 직접 정의 (브랜드 로고)
export const ODPLogo = () => ( /* SVG 인라인 */ );
export const OpenBBLogo = () => ( /* SVG 인라인 */ );
```

---

#### `utils/index.ts`
| 항목 | 내용 |
|------|------|
| **역할** | CSS 클래스 조합 유틸리티 |
| **내용** | `cn(...inputs)` = clsx 래퍼 단 한 줄 |

```typescript
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
```

---

## LAYER 2: Widget Renderer

### Python → Frontend 데이터 전달 메커니즘

두 위젯 모두 동일한 메커니즘을 사용한다.

```
Python (OpenBB Platform)
    │
    │  PyWry 또는 Tauri WebView
    │  window.json_data = JSON.stringify(data)
    ▼
JavaScript (100ms 폴링)
    interval = setInterval(() => {
      if (window.json_data) {
        setData(window.json_data);
        clearInterval(interval);   // 1회만 수신
      }
    }, 100);
```

`window.json_data`는 Python이 WebView의 JS 컨텍스트에 직접 주입하는 변수다.

---

## PART A: Plotly 차트 위젯

### 데이터 흐름 전체도

```
window.json_data (JSON)
        │
        ▼ App.tsx: transformData()
{
  data:    Plotly.Figure  ← 차트 traces + layout
  date:    Date
  globals: { added_traces, csv_yaxis_id, cmd_src, old_margin, title }
  cmd:     "/equity/price/historical"
  theme:   "dark" | "light"
  title:   "AAPL Stock Price"
}
        │
        ▼ Chart.tsx props
useState(originalData)
useState(plotData)      ← 현재 렌더링 중인 데이터 (필터/수정 가능)
useState(annotations)
useState(modal)
useState(darkMode)
useState(autoScale)
        │
        ▼ Plotly.react(plotDiv, data.data, data.layout)
        │
        ▼ SVG 차트 렌더링
```

---

### 파일별 분석 (Plotly)

#### `plotly/src/main.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | React 진입점, `#root`에 App 마운트 |
| **빌드** | `vite-plugin-singlefile` → 단일 HTML 파일 출력 |

---

#### `plotly/src/App.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 데이터 수신 + 변환 + Chart 렌더링 결정 |
| **LOC** | 142줄 |
| **입력** | `window.json_data` (production), `candlestickMockup` (dev) |
| **출력** | `<Chart>` 또는 로딩 스피너 |

**변환 로직 (`transformData`)**:
```typescript
const transformData = (data: any) => {
  // 1. 파일명 생성 (export 시 사용)
  const filename = data.layout?.title?.text
    .replace(/ -/g, "").replace(/-/g, "")
    .replace(/<b>|<\/b>/g, "").replace(/ /g, "_");
  window.title = `openbb_${filename}_${date}_${time}`;

  // 2. 명령 어노테이션 처리
  //    layout.annotations 중 text가 "/"로 시작하면
  //    → cmd_src에 저장 후 빈 문자열로 교체 (화면에 표시 안 함)
  data.layout.annotations?.forEach(annotation => {
    if (annotation.text?.[0] === "/") {
      globals.cmd_src = annotation.text;
      annotation.text = "";
      // 상단 여백 축소 (명령어 공간 제거)
      if (margin.t > 40) margin.t = 40;
    }
  });

  // 3. 툴팁 길이 무제한 설정
  data.data.forEach(trace => {
    if (trace.name) trace.hoverlabel = { namelength: -1 };
  });

  return { data, date, globals, cmd, theme, title };
};
```

**globals 객체 (Chart.tsx로 전달)**:
```typescript
globals = {
  added_traces: [],      // 사용자가 추가한 오버레이 traces
  csv_yaxis_id: null,    // CSV 오버레이 y축 ID
  cmd_src_idx: null,     // 명령 어노테이션 인덱스
  cmd_idx: null,
  cmd_src: "",           // 명령 경로 (예: "/equity/price/historical")
  old_margin: null,      // 원본 여백 (복원용)
  title: "",
}
```

---

#### `plotly/src/components/Chart.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | Plotly 차트 메인 렌더링 + 모든 상호작용 |
| **LOC** | 906줄 |
| **의존성** | Plotly.js, react-hotkeys-hook |
| **입력** | `{ json, date, cmd, title, globals, theme }` |
| **출력** | `<div id="MainChart">` + 모달들 |

**상태 목록**:
```typescript
const [originalData, setOriginalData]     = useState(json);   // 초기 원본
const [plotData,     setPlotDataState]    = useState(json);   // 현재 렌더 데이터
const [darkMode,     setDarkMode]         = useState(true);
const [chartTitle,   setChartTitle]       = useState(title);
const [axesTitles,   setAxesTitles]       = useState({});     // x/y 축 레이블
const [annotations,  setAnnotations]      = useState([]);     // 사용자 어노테이션
const [modal,        setModal]            = useState({ name: "" });
const [autoScale,    setAutoScaling]      = useState(false);
const [changeColor,  setChangeColor]      = useState(false);
const [LogYaxis,     setLogYaxis]         = useState(false);
const [plotDiv,      setPlotDiv]          = useState(null);   // Plotly DOM 참조
const [loading,      setLoading]          = useState(false);
```

**핵심 함수 `setPlotData`**:
```typescript
// 모든 차트 업데이트의 단일 진입점
function setPlotData(data: any) {
  data.layout.datarevision = (data.layout.datarevision || 0) + 1;
  setPlotDataState(data);
  if (plotDiv && plotData) {
    Plotly.react(plotDiv, data.data, data.layout); // Plotly 직접 업데이트
  }
}
```

**모달 시스템**:
```
modal.name 값에 따라 다른 Dialog 표시
  "textDialog"    → TextChartDialog  (어노테이션 편집)
  "titleDialog"   → TitleChartDialog (제목/축 레이블 변경)
  "alert"         → AlertDialog      (에러/정보)
  "overlayChart"  → OverlayChartDialog (CSV 파일 오버레이)
  ""              → 모달 없음
```

**자동 스케일링 로직**:
```typescript
// Plotly relayout 이벤트 → 날짜 범위 변경 감지
plotDiv.on("plotly_relayout", (eventdata) => {
  if (eventdata["xaxis.range[0]"]) {
    // 범위 내 데이터만 필터링
    const filteredData = filterDataByRange(originalData, range);
    setPlotData(filteredData);
  }
});
```

**테마 전환**:
```typescript
useEffect(() => {
  const darkmode = !darkMode;
  originalData.layout.template = darkmode
    ? DARK_CHARTS_TEMPLATE   // Config.tsx에서 import
    : LIGHT_CHARTS_TEMPLATE;
  setPlotData({ ...originalData });
}, [changeTheme]);
```

---

#### `plotly/src/components/PlotlyConfig.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | Plotly 모드바 설정 + 핫키 바인딩 |
| **LOC** | ~200줄 |
| **출력** | `config` 객체 (Plotly.newPlot에 전달) + `ChartHotkeys` 컴포넌트 |

**모드바 버튼 그룹**:
```
Group 1: [drawline, drawopenpath, drawcircle, drawrect, eraseshape]
Group 2: [editColor, overlayChart, addText, changeTitles, toggleTheme]
Group 3: [toImage, autoScale]
Group 4: [zoomIn, zoomOut, zoom, pan, resetAxes]
```

**핫키 매핑**:
```
Ctrl+Shift+T  → 제목/축 변경 다이얼로그
Ctrl+T        → 텍스트 어노테이션 추가
Ctrl+O        → CSV 오버레이 다이얼로그
Ctrl+E        → 색상 편집 모드
Ctrl+L        → 로그 y축 전환
Ctrl+Shift+H  → 모드바 숨기기/표시
Ctrl+Shift+A  → 자동 스케일링 토글
```

---

#### `plotly/src/components/Config.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 테마 템플릿 + 아이콘 SVG 경로 데이터 |
| **출력** | `DARK_CHARTS_TEMPLATE`, `LIGHT_CHARTS_TEMPLATE`, `ICONS` |

```typescript
// 모드바 커스텀 아이콘 (SVG path 데이터)
export const ICONS = {
  sunIcon:     { path: "M...", newShape: "M..." },
  moonIcon:    { path: "M..." },
  plotCsv:     { path: "M..." },
  addText:     { path: "M..." },
  changeTitle: { path: "M..." },
  changeColor: { path: "M..." },
};

// Plotly 다크 테마
export const DARK_CHARTS_TEMPLATE = {
  layout: {
    paper_bgcolor: "#000000",
    plot_bgcolor:  "#000000",
    font:          { color: "#ffffff" },
    colorway:      ["#1f77b4", "#ff7f0e", "#2ca02c", ...],
    xaxis:         { gridcolor: "#333", linecolor: "#666" },
    yaxis:         { gridcolor: "#333", linecolor: "#666" },
  }
};
```

---

#### `plotly/src/components/AutoScaling.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | x축 범위 변경 시 y축 자동 스케일링 |
| **입력** | `plotDiv`, `originalData`, `setPlotData` |

---

#### `plotly/src/components/ResizeHandler.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 창 크기 변경 시 `Plotly.Plots.resize(plotDiv)` 호출 |

---

#### `plotly/src/components/ChangeColor.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 각 trace의 색상 팔레트 UI |
| **입력** | `plotData.data` (trace 배열) |
| **출력** | 색상 변경 → `setPlotData` 호출 |

---

#### `plotly/src/components/Dialogs/CommonDialog.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 모달 공통 래퍼 (`@radix-ui/react-dialog` 기반) |
| **출력** | 제목 + 설명 + 닫기 버튼 + children |

---

#### `plotly/src/components/Dialogs/TextChartDialog.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 어노테이션 텍스트 입력 다이얼로그 |
| **입력** | 기존 어노테이션 데이터 (수정 시) |
| **출력** | `addAnnotation(plotData, text, x, y)` 호출 |

---

#### `plotly/src/components/Dialogs/TitleChartDialog.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 차트 제목 / x축 / y축 레이블 변경 |
| **출력** | `plotData.layout.title.text`, `plotData.layout.xaxis.title` 업데이트 → `setPlotData` |

---

#### `plotly/src/components/Dialogs/OverlayChartDialog.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 로컬 CSV 파일을 차트에 오버레이 |
| **흐름** | 파일 선택 → CSV 파싱 → `globals.added_traces`에 추가 → `setPlotData` |

---

#### `plotly/src/components/Dialogs/AlertDialog.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 에러/경고/정보 알림 모달 |
| **입력** | `{ type: "error"|"info", message }` |

---

#### `plotly/src/utils/addAnnotation.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 어노테이션 초기화/추가/삭제 로직 |
| **입력** | `{ plotData, popupData, setPlotData, annotations, plotDiv }` |

```typescript
export function init_annotation({ plotData, popupData, setPlotData, ... }) {
  // 클릭 좌표 → 어노테이션 생성
  const annotation = {
    x: popupData.points[0].x,
    y: popupData.points[0].y,
    text: "",
    showarrow: true,
    arrowhead: 2,
  };
  plotData.layout.annotations = [...(plotData.layout.annotations || []), annotation];
  setPlotData({ ...plotData });
}
```

---

#### `plotly/src/data/mockup.ts`
| 항목 | 내용 |
|------|------|
| **역할** | 개발 환경용 캔들스틱 차트 목 데이터 |
| **형식** | Plotly Figure JSON (OHLCV + 이동평균선) |
| **사용** | `process.env.NODE_ENV !== "production"` 시 `useState` 초기값 |

---

## PART B: Tables 위젯

### 데이터 흐름 전체도

```
window.json_data (JSON string)
        │
        ▼ App.tsx: JSON.parse
{
  columns: ["Symbol", "Price", "Change%"],   // 열 이름 배열
  index:   [0, 1, 2, ...],                   // 행 인덱스
  data:    [["AAPL", 150.5, 1.2], ...],      // 2D 배열
  title:   "Stock Prices",
  theme:   "dark",
  command_location: "/stocks/quotes"
}
        │
        ▼ App.tsx: transformData()
{
  columns: ["Symbol", "Price", "Change%"],
  data: [
    { Symbol: "AAPL", Price: 150.5, "Change%": 1.2 },
    { Symbol: "GOOGL", Price: 140.2, "Change%": -0.5 },
  ]
}
        │
        ▼ Table/index.tsx
        │  useReactTable({ data, columns })
        ▼
HTML <table> 렌더링
```

---

### 파일별 분석 (Tables)

#### `tables/src/main.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | React 진입점 |
| **특이점** | `React.StrictMode` 적용 |

---

#### `tables/src/App.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 데이터 수신 + 행렬→객체 변환 + Table 렌더링 |
| **LOC** | 101줄 |
| **입력** | `window.json_data` (JSON string) |
| **출력** | `<DndProvider><Table /></DndProvider>` |

**변환 로직 (행렬 → 객체 배열)**:
```typescript
const transformData = (data: any) => {
  // 파일명 생성
  window.title = `openbb_${filename}_${date}_${time}`;

  const { columns, data: newData } = data;
  // 2D 배열 → Record<string, any>[]
  const transformedData = newData.map((row: any[]) => {
    const obj: Record<string, any> = {};
    row.forEach((value, i) => {
      obj[columns[i]] = value ?? (value === 0 ? 0 : "");
    });
    return obj;
  });
  return { columns, data: transformedData };
};
```

**Python 원본 포맷 (pandas DataFrame → JSON)**:
```python
# Python 측
df.to_json(orient="split")
# 결과
{
  "columns": ["Symbol", "Price"],
  "index": [0, 1, 2],
  "data": [["AAPL", 150.5], ["GOOGL", 140.2]]
}
```

---

#### `tables/src/components/Table/index.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | TanStack React Table 전체 기능 |
| **LOC** | 736줄 |
| **의존성** | `@tanstack/react-table`, `react-dnd` |
| **입력** | `{ data, columns, title, initialTheme, cmd }` |
| **출력** | 완전한 인터랙티브 데이터 테이블 |

**TanStack Table 인스턴스**:
```typescript
const table = useReactTable({
  data,
  columns: rtColumns,
  state: { sorting, globalFilter, columnVisibility, pagination },
  onSortingChange: setSorting,
  onGlobalFilterChange: setGlobalFilter,
  onColumnVisibilityChange: setColumnVisibility,
  onPaginationChange: setPagination,
  getCoreRowModel:       getCoreRowModel(),
  getSortedRowModel:     getSortedRowModel(),
  getFilteredRowModel:   getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  filterFns: { fuzzy: fuzzyFilter },  // utils/utils.ts에서 import
  globalFilterFn: "fuzzy",
});
```

**동적 열 정의 (`rtColumns`)**:
```typescript
const rtColumns = useMemo(() => columns.map(column => ({
  accessorKey: column,
  header: ({ column: col }) => (
    <DraggableColumnHeader column={col} />  // 드래그 가능
  ),
  size: getColumnWidth(data, column),
  cell: ({ row, getValue }) => {
    const value = getValue();

    // 자동 타입 감지
    if (isDate(column, value))   return <Timestamp date={value} />;
    if (isLink(value))           return <a href={value}>{value}</a>;
    if (isNumber(value, column)) return <span>{formatNumberMagnitude(value, column)}</span>;
    return <p>{value}</p>;
  },
})), [data, columns]);
```

**자동 타입 감지 규칙**:
```
날짜 열:   column 이름에 "date"|"day"|"time"|"timestamp"|"year" 포함
링크:      value가 "http"로 시작
숫자:      typeof value === "number"
가격:      column 이름에 "price"|"open"|"close" 포함 → 소수점 많이 표시
큰 수:     100,000 초과 → K/M/B/T 단위 표시
```

**상태 목록**:
```typescript
const [sorting,          setSorting]          = useState<SortingState>([]);
const [globalFilter,     setGlobalFilter]      = useState("");
const [columnVisibility, setColumnVisibility]  = useState(defaultVisible);
const [pagination,       setPagination]        = useState({ pageSize: 30 });
const [darkMode,         setDarkMode]          = useDarkMode(initialTheme);
const [currentPage,      setCurrentPage]       = useLocalStorage("rowsPerPage", 30);
const [fontSize,         setFontSize]          = useLocalStorage("fontSize", "1");
const [exportType,       setExportType]        = useLocalStorage("exportType", "csv");
const [columnOrder,      setColumnOrder]       = useState<string[]>([]);  // DnD
const [toast,            setToast]             = useState<ToastState | null>(null);
```

---

#### `tables/src/components/Table/ColumnHeader.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 드래그 가능한 열 헤더 (react-dnd) |
| **기능** | 열 순서 변경 (drag & drop), 정렬 클릭 |

```typescript
// DnD 타입
const DND_TYPE = "column";

// useDrag: 이 헤더를 드래그 가능하게
const [{ isDragging }, drag] = useDrag({ type: DND_TYPE, item: { id } });

// useDrop: 다른 헤더를 드롭 받을 수 있게
const [{ isOver }, drop] = useDrop({
  accept: DND_TYPE,
  drop: (item) => onReorder(item.id, id),  // 순서 교체
});
```

---

#### `tables/src/components/Table/Export.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | CSV / PNG 내보내기 버튼 |
| **의존성** | `utils/utils.ts` (downloadData, downloadImage) |

---

#### `tables/src/components/Table/FilterColumns.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 열 표시/숨기기 드롭다운 |
| **의존성** | `utils/useClickOutside.tsx` |

---

#### `tables/src/components/Table/Pagination.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 페이지네이션 UI + 페이지당 행 수 선택 |

---

#### `tables/src/components/Table/DebouncedInput.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 디바운스 처리된 검색 입력창 |
| **사용** | `globalFilter` (전체 텍스트 검색) |

---

#### `tables/src/components/Table/Timestamp.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 날짜 문자열을 읽기 쉬운 형태로 포맷 |

---

#### `tables/src/components/Toast.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | 다운로드 완료 등 상태 알림 |
| **의존성** | `@radix-ui/react-toast`, Icons 5개 |
| **상태 타입** | `"success" \| "error" \| "info" \| "warning"` |

---

#### `tables/src/utils/useDarkMode.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | `<html>` 태그 class 토글 (tailwind dark mode) |
| **의존성** | `useLocalStorage` |

```typescript
export function useDarkMode(initial: "dark" | "light") {
  const [theme, setTheme] = useLocalStorage("theme", initial);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return [theme === "dark", (v: boolean) => setTheme(v ? "dark" : "light")];
}
```

---

#### `tables/src/utils/useLocalStorage.tsx`
| 항목 | 내용 |
|------|------|
| **역할** | localStorage 동기화 useState |

```typescript
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  const set = (v: T) => {
    localStorage.setItem(key, JSON.stringify(v));
    setValue(v);
  };

  return [value, set] as const;
}
```

---

#### `tables/src/utils/utils.ts`
| 항목 | 내용 |
|------|------|
| **역할** | 수치 포맷 + 파일 다운로드 + 퍼지 검색 |
| **LOC** | 320줄 |

**주요 함수**:
```typescript
// 숫자 단위 변환: 1,500,000 → "1.5 M"
export function formatNumberMagnitude(value: number|string, column?: string): string

// 퍼지 검색 (TanStack filterFn으로 등록)
export const fuzzyFilter = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value);
  addMeta(itemRank);
  return itemRank;
};

// CSV 다운로드
export async function downloadData(type: "csv", columns, data, onDone): Promise<void>

// PNG 다운로드 (dom-to-image)
export async function downloadImage(id: string, onDone): Promise<void>

// 디바운스
export const non_blocking = (func: Function, delay: number) => { ... }
```

---

#### `tables/src/data/mockup.ts`
| 항목 | 내용 |
|------|------|
| **역할** | 개발 환경용 목 데이터 4종 |
| **데이터** | `cryptoData`, `incomeData`, `longIncomeData`, `performanceData` |
| **형식** | pandas `orient="split"` JSON 문자열 |

---

## 전체 데이터 흐름 다이어그램

```
┌─────────────────────────────────────────────────────────┐
│                   Python Backend                         │
│  OpenBB Platform CLI / Jupyter                          │
│                                                         │
│  chart_data = {                                         │
│    "data": [...],      ← Plotly traces                  │
│    "layout": {...},    ← Plotly layout                  │
│    "theme": "dark",                                     │
│    "command_location": "/equity/price/historical"       │
│  }                                                      │
│  table_data = df.to_json(orient="split")                │
└─────────────────────┬───────────────────────────────────┘
                      │
              PyWry WebView 주입
              window.json_data = data
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
  ┌──────────────┐       ┌──────────────┐
  │ plotly/      │       │ tables/      │
  │ App.tsx      │       │ App.tsx      │
  │              │       │              │
  │ 폴링 100ms   │       │ 폴링 100ms   │
  │ transformData│       │ JSON.parse   │
  │              │       │ transformData│
  └──────┬───────┘       └──────┬───────┘
         │                      │
         ▼                      ▼
  ┌──────────────┐       ┌──────────────┐
  │ Chart.tsx    │       │ Table/       │
  │              │       │ index.tsx    │
  │ - plotData   │       │              │
  │ - globals    │       │ - sorting    │
  │ - modal      │       │ - filter     │
  │ - darkMode   │       │ - pagination │
  │ - autoScale  │       │ - colOrder   │
  │              │       │ - darkMode   │
  └──────┬───────┘       └──────┬───────┘
         │                      │
         ▼                      ▼
  Plotly.react()          useReactTable()
  SVG 렌더링              HTML table 렌더링
         │                      │
         ▼                      ▼
  ┌──────────────┐       ┌──────────────┐
  │ 다이얼로그들  │       │ 서브컴포넌트  │
  │ - TextChart  │       │ - ColumnHdr  │
  │ - TitleChart │       │ - Export     │
  │ - Alert      │       │ - Filter     │
  │ - Overlay    │       │ - Pagination │
  │ - ChangeColor│       │ - Toast      │
  └──────────────┘       └──────────────┘


별도: Desktop App (Tauri IPC)

  routes/
  ├── api-keys.tsx  → invoke("get/update_user_credentials")
  ├── backends.tsx  → invoke("start/stop_backend_service")
  └── environments.tsx → invoke("create_environment")
                         listen("environment_progress")
```

---

## 컴포넌트 의존성 그래프

### Plotly 의존성

```
App.tsx
  └── Chart.tsx
        ├── Config.tsx              (ICONS, DARK/LIGHT_TEMPLATE)
        ├── PlotlyConfig.tsx        (PlotConfig, ChartHotkeys)
        ├── AutoScaling.tsx
        ├── ResizeHandler.tsx
        ├── ChangeColor.tsx
        ├── Dialogs/
        │   ├── CommonDialog.tsx    (공통 모달 래퍼)
        │   │   └── Icons/Close.tsx
        │   ├── TextChartDialog.tsx
        │   │   └── CommonDialog.tsx
        │   ├── TitleChartDialog.tsx
        │   │   └── CommonDialog.tsx
        │   ├── AlertDialog.tsx
        │   │   └── CommonDialog.tsx
        │   └── OverlayChartDialog.tsx
        │       └── CommonDialog.tsx
        └── utils/addAnnotation.tsx
```

### Tables 의존성

```
App.tsx
  ├── DndProvider (react-dnd)
  └── Chart.tsx (실제론 Table 컴포넌트)
        └── Table/index.tsx
              ├── ColumnHeader.tsx    (react-dnd)
              ├── Export.tsx
              │   └── utils/utils.ts  (downloadData, downloadImage)
              ├── FilterColumns.tsx
              │   └── utils/useClickOutside.tsx
              ├── Pagination.tsx
              ├── DebouncedInput.tsx
              ├── Timestamp.tsx
              ├── InderterminateCheckbox.tsx
              ├── DownloadFinishedDialog.tsx
              │   └── Icons/Close.tsx
              ├── Toast.tsx
              │   └── Icons/ (Close, CloseCircle, Info, Success, Warning)
              ├── utils/useDarkMode.tsx
              │   └── utils/useLocalStorage.tsx
              └── utils/utils.ts      (fuzzyFilter, formatNumberMagnitude)
```

### Desktop 의존성

```
main.tsx
  └── __root.tsx (RootWithProvider)
        ├── EnvironmentCreationContext.tsx
        ├── Icon.tsx                (ODPLogo, OpenBBLogo, CustomIcon)
        └── Outlet
              ├── api-keys.tsx
              │   ├── Icon.tsx (CustomIcon)
              │   └── components/Toast.tsx
              ├── backends.tsx
              │   ├── Icon.tsx
              │   └── components/Toast.tsx
              └── environments.tsx
                  ├── EnvironmentCreationContext.tsx
                  └── components/Toast.tsx
```

---

## 핵심 패턴 정리

| 패턴 | 위치 | 내용 |
|------|------|------|
| **window 폴링** | plotly/App.tsx, tables/App.tsx | `setInterval(100ms)` → `window.json_data` 체크 → 1회 수신 후 중단 |
| **단방향 데이터** | 두 위젯 전체 | Python → window → App → 컴포넌트 (역방향 없음) |
| **Tauri IPC** | desktop/routes | `invoke()` = 동기 요청/응답, `listen()` = 비동기 이벤트 수신 |
| **상태 분리** | Chart.tsx | `originalData` (불변) vs `plotData` (표시용, 수정 가능) |
| **단일 업데이트 진입점** | Chart.tsx `setPlotData()` | 모든 차트 변경은 이 함수 하나를 통과 |
| **LocalStorage 상태** | tables/Table | 사용자 설정(정렬/페이지/테마) 새로고침 후에도 유지 |
| **퍼지 검색** | tables/utils | `@tanstack/match-sorter-utils` 기반 전역 필터 |
| **mock 데이터 분기** | 두 App.tsx | `NODE_ENV !== "production"` → 목 데이터 / production → 폴링 |
