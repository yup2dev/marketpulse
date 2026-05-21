# OpenBB Platform - Application Architecture Guide

**작성일**: 2026-05-20  
**프로젝트**: OpenBB-finance/OpenBB  
**저장소**: https://github.com/OpenBB-finance/OpenBB  
**언어**: Python 100%
┌────────────────────────────────────────────────────────┐ │ 사용자 계층 │ ├────────────────────────────────────────────────────────┤ │ Python SDK │ REST API │ CLI │ Desktop App (Tauri) │ └──────────────────────┬─────────────────────────────────┘ │ ┌──────────────────────▼─────────────────────────────────┐ │ 라우팅 계층 (Router) │ ├────────────────────────────────────────────────────────┤ │ @router.command() │ │ ├─ CommandContext │ │ ├─ ProviderChoices │ │ ├─ StandardParams │ │ └─ ExtraParams │ └──────────────────────┬─────────────────────────────────┘ │ ┌──────────────────────▼─────────────────────────────────┐ │ Query 실행 계층 (Query & Executor) │ ├────────────────────────────────────────────────────────┤ │ Query.execute() → QueryExecutor.execute() │ │ ├─ Provider Registry 조회 │ │ └─ 자격증명 필터링 │ └──────────────────────┬─────────────────────────────────┘ │ ┌──────────────────────▼─────────────────────────────────┐ │ Fetcher 계층 (3단계 파이프라인) │ ├────────────────────────────────────────────────────────┤ │ ① transform_query() - 파라미터 변환 │ │ ② extract_data() - API 호출 │ │ └─ ③ transform_data() - 데이터 변환 │ └──────────────────────┬─────────────────────────────────┘ │ ┌──────────────────────▼─────────────────────────────────┐ │ 캐싱 계층 (선택사항 - aiohttp-cache) │ ├────────────────────────────────────────────────────────┤ │ Redis │ SQLite │ MongoDB │ DynamoDB │ Filesystem │ └──────────────────────┬─────────────────────────────────┘ │ ┌──────────────────────▼─────────────────────────────────┐ │ 저장 계층 (Storage) │ ├────────────────────────────────────────────────────────┤ │ ~/.openbb_platform/user_settings.json │ │ ~/.openbb_platform/system_settings.json │ └──────────────────────┬─────────────────────────────────┘ │ ┌──────────────────────▼─────────────────────────────────┐ │ 결과 모델 계층 (OBBject) │ ├────────────────────────────────────────────────────────┤ │ results │ provider │ warnings │ chart │ extra │ └──────────────────────┬─────────────────────────────────┘ │ ┌───────────────┼───────────────┐ │ │ │ Python JSON API Desktop UI Return Response Rendering

Code

---

## 데이터 흐름

### 1단계: 사용자 호출 (User Invocation)

**Python SDK 호출:**
```python
from openbb import obb

# 자동으로 user_settings.json 로드
output = obb.equity.price.historical("AAPL")
REST API 호출:

bash

curl -X GET "http://127.0.0.1:6900/api/v1/equity/price/historical?symbol=AAPL"
Desktop App:

Code

UI: Equity → Price → Historical → Symbol: AAPL → Query

2단계: 라우팅 및 명령 매핑 (Routing)
사용자 입력이 올바른 라우터 함수로 매핑됩니다:

Python

# 라우터 정의
router = Router(prefix="/equity/price")

@router.command(model="EquityHistorical")
async def historical(
    cc: CommandContext,
    provider_choices: ProviderChoices,
    standard_params: StandardParams,
    extra_params: ExtraParams,
) -> OBBject:
    """Get historical equity price data."""
    return await OBBject.from_query(Query(**locals()))
라우팅 프로세스:
    1. 엔드포인트 경로 확인 → /equity/price/historical
    2. 모델명 확인 → EquityHistorical
    3. 의존성 주입:
        * CommandContext: 사용자 설정, 자격증명 로드
        * ProviderChoices: 선택된 Provider 결정
        * StandardParams: 표준 파라미터 (symbol, start_date 등)
        * ExtraParams: Provider별 특수 파라미터

3단계: Query 생성 및 실행

Python

class Query:
    def __init__(self, cc, provider_choices, standard_params, extra_params):
        self.provider = provider_choices.provider  # "fmp"
        self.standard_params = standard_params      # {"symbol": "AAPL"}
        self.extra_params = extra_params            # {}
        self.name = "EquityHistorical"
    
    async def execute(self):
        # 파라미터 준비
        standard_dict = asdict(self.standard_params)
        extra_dict = self.filter_extra_params(...)
        
        # Executor 생성 및 실행
        query_executor = self.provider_interface.create_executor()
        return await query_executor.execute(
            provider_name=self.provider,
            model_name=self.name,
            params={**standard_dict, **extra_dict},
            credentials=self.cc.user_settings.credentials.model_dump(),
        )

4단계: Provider & Fetcher 조회

Python

class QueryExecutor:
    async def execute(self, provider_name, model_name, params, credentials):
        # ① Provider 조회
        provider = self.get_provider("fmp")
        # → Provider(name="fmp", fetcher_dict={...})
        
        # ② Fetcher 조회
        fetcher_class = self.get_fetcher(provider, "EquityHistorical")
        # → FMPEquityHistoricalFetcher
        
        # ③ 자격증명 필터링
        filtered_credentials = self.filter_credentials(
            credentials, provider, fetcher_class.require_credentials
        )
        # → {"fmp_api_key": "YOUR_KEY"}
        
        # ④ Fetcher 실행
        return await fetcher_class.fetch_data(params, filtered_credentials)

5단계: Fetcher 3단계 파이프라인
Fetcher는 3가지 메서드로 구성됩니다:

Python

class FMPEquityHistoricalFetcher(Fetcher):
    
    # ① 파라미터 변환: 표준 형식 → Provider 특정 형식
    @staticmethod
    def transform_query(params):
        return EquityHistoricalQueryParams(
            symbol=params["symbol"],
            start_date=params.get("start_date"),
        )
    
    # ② 데이터 추출: API 호출
    @staticmethod
    async def aextract_data(query, credentials):
        api_key = credentials["fmp_api_key"]
        url = "https://financialmodelingprep.com/api/v3/historical-price-full"
        params = {
            "symbol": query.symbol,
            "apikey": api_key,
        }
        return await amake_request(url, params=params)
    
    # ③ 데이터 변환: Raw API 응답 → 표준 Data 모델
    @staticmethod
    def transform_data(query, data):
        results = []
        for item in data.get("historical", []):
            results.append(EquityHistoricalData(
                date=item["date"],
                open=float(item["open"]),
                high=float(item["high"]),
                low=float(item["low"]),
                close=float(item["close"]),
                volume=int(item["volume"]),
            ))
        return results
각 단계의 목적:
단계	입력	출력	목적
transform_query	{"symbol": "AAPL"}	EquityHistoricalQueryParams(...)	Provider API 형식으로 변환
extract_data	QueryParams + 자격증명	Raw JSON	외부 API 호출
transform_data	Raw JSON	List[EquityHistoricalData]	표준 모델로 정규화
6단계: 결과 생성 및 반환

Python

class OBBject:
    @classmethod
    async def from_query(cls, query):
        results = await query.execute()
        
        # AnnotatedResult 처리 (메타데이터 포함)
        if isinstance(results, AnnotatedResult):
            return cls(
                results=results.result,
                extra={"results_metadata": results.metadata}
            )
        
        # 일반 결과
        return cls(results=results)

# 반환된 OBBject 구조
OBBject(
    results=List[EquityHistoricalData],
    provider="fmp",
    warnings=[],
    chart=None,
    extra={}
)
사용자가 받는 데이터:

Python

# Python에서
df = output.to_dataframe()          # Pandas DataFrame
json_data = output.to_json()        # JSON 문자열
dict_data = output.to_dict()        # Python Dict

# API에서
{
    "results": [...],
    "provider": "fmp",
    "warnings": [],
    "chart": null,
    "extra": {}
}

계층별 상세 분석
1. 라우팅 계층 (Router Layer)
책임: 사용자 요청을 올바른 명령 함수로 라우팅
주요 클래스:
    * Router: OpenBB 라우터 래퍼
    * CommandMap: 라우트와 명령의 매핑
    * RouterLoader: 확장에서 라우터 동적 로드
주요 메서드:

Python

class Router:
    # 라우트 등록
    @overload
    def command(self, func: Callable) -> Callable:
        pass
    
    # 의존성 주입을 통한 라우트 등록
    def command(self, func, **kwargs):
        # 함수 서명 검증
        func = SignatureInspector.complete(func, model)
        # FastAPI 엔드포인트 등록
        api_router.add_api_route(**kwargs)
        return func
    
    # 자식 라우터 포함
    def include_router(self, router, prefix=""):
        self._api_router.include_router(
            router=router.api_router,
            prefix=prefix,
        )
SignatureInspector:

Python

class SignatureInspector:
    @classmethod
    def complete(cls, func, model):
        # 함수 서명 검증
        # 의존성 주입 (Provider, StandardParams, ExtraParams)
        # 반환 타입 주석 주입
        return func
    
    @staticmethod
    def validate_signature(func, expected):
        # CommandContext, ProviderChoices, StandardParams, ExtraParams 확인
        pass
    
    @staticmethod
    def inject_dependency(func, arg, callable_):
        # Annotated[Depends()] 추가
        func.__annotations__[arg] = Annotated[callable_, Depends()]
        return func

2. Query 실행 계층 (Query Execution Layer)
책임: 파라미터를 정규화하고 Executor 호출
Query 클래스:

Python

class Query:
    def __init__(self, cc, provider_choices, standard_params, extra_params):
        self.cc = cc                          # CommandContext
        self.provider = provider_choices.provider
        self.standard_params = standard_params
        self.extra_params = extra_params
        self.name = standard_params.__class__.__name__  # "EquityHistorical"
    
    def filter_extra_params(self, extra_params, provider_name):
        """Provider가 지원하지 않는 파라미터 제거 및 경고"""
        filtered = {}
        for key, value in asdict(extra_params).items():
            if value != default_value:
                if provider_name in supported_providers:
                    filtered[key] = value
                else:
                    # 경고: 이 파라미터는 지원되지 않음
                    pass
        return filtered
    
    async def execute(self):
        """쿼리 실행"""
        standard_dict = asdict(self.standard_params)
        extra_dict = self.filter_extra_params(...)
        
        query_executor = self.provider_interface.create_executor()
        return await query_executor.execute(
            provider_name=self.provider,
            model_name=self.name,
            params={**standard_dict, **extra_dict},
            credentials=self.cc.user_settings.credentials.model_dump(),
        )

3. Provider & Registry 계층
책임: 데이터 제공자 등록, 조회, 관리
Provider 클래스:

Python

class Provider:
    def __init__(self, name, description, website, credentials, fetcher_dict):
        self.name = name                    # "fmp"
        self.description = description
        self.website = website
        # 자격증명: ["{provider}_{credential_name}"]
        self.credentials = [f"{name}_{c}" for c in (credentials or [])]
        # Fetcher 매핑: {"ModelName": FetcherClass}
        self.fetcher_dict = fetcher_dict or {}
Provider 등록 예시:

Python

# providers/fmp/__init__.py
fmp_provider = Provider(
    name="fmp",
    description="Financial Modeling Prep",
    website="https://financialmodelingprep.com",
    credentials=["api_key"],
    fetcher_dict={
        "EquityHistorical": FMPEquityHistoricalFetcher,
        "EquityQuote": FMPEquityQuoteFetcher,
    },
)
Registry:

Python

class Registry:
    def __init__(self):
        self.providers = {}  # {"fmp": Provider, "alpha_vantage": Provider, ...}
    
    def get_provider(self, name):
        return self.providers.get(name.lower())

class RegistryLoader:
    @staticmethod
    @lru_cache
    def from_extensions():
        """확장에서 Provider 동적 로드"""
        registry = Registry()
        for name, provider in ExtensionLoader().core_objects.items():
            registry.providers[name] = provider
        return registry

4. Fetcher 계층 (Fetcher Layer)
책임: 실제 데이터 추출 및 변환
Fetcher 추상 클래스:

Python

class Fetcher(Generic[Q, R]):
    require_credentials = True
    
    @staticmethod
    def transform_query(params: dict[str, Any]) -> Q:
        """표준 파라미터 → Provider 특정 쿼리"""
        raise NotImplementedError
    
    @staticmethod
    async def aextract_data(query: Q, credentials: dict) -> Any:
        """비동기 데이터 추출 (async 권장)"""
        pass
    
    @staticmethod
    def extract_data(query: Q, credentials: dict) -> Any:
        """동기 데이터 추출"""
        pass
    
    @staticmethod
    def transform_data(query: Q, data: Any) -> R:
        """Raw 데이터 → 표준 모델"""
        raise NotImplementedError
    
    @classmethod
    async def fetch_data(cls, params: dict, credentials: dict):
        """전체 파이프라인 실행"""
        query = cls.transform_query(params=params)
        data = await maybe_coroutine(
            cls.extract_data, query=query, credentials=credentials
        )
        return cls.transform_data(query=query, data=data)
구체적인 Fetcher 구현:

Python

class FMPEquityHistoricalFetcher(
    Fetcher[EquityHistoricalQueryParams, list[EquityHistoricalData]]
):
    
    @staticmethod
    def transform_query(params):
        return EquityHistoricalQueryParams(**params)
    
    @staticmethod
    async def aextract_data(query, credentials):
        api_key = credentials["fmp_api_key"]
        url = "https://financialmodelingprep.com/api/v3/historical-price-full"
        return await amake_request(url, params={
            "symbol": query.symbol,
            "apikey": api_key,
        })
    
    @staticmethod
    def transform_data(query, data):
        return [
            EquityHistoricalData(
                date=item["date"],
                open=float(item["open"]),
                close=float(item["close"]),
                # ...
            )
            for item in data.get("historical", [])
        ]

5. 모델 계층 (Model Layer)
QueryParams 모델:

Python

class EquityHistoricalQueryParams(QueryParams):
    """표준 주가 데이터 쿼리 파라미터"""
    symbol: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    interval: str = "daily"
Data 모델:

Python

class EquityHistoricalData(Data):
    """표준 주가 데이터"""
    date: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int
    adjusted_close: Optional[float] = None
모델의 역할:
    * Pydantic BaseModel 상속
    * 필드 검증 (타입, 범위)
    * 직렬화/역직렬화
    * JSON Schema 생성

저장 메커니즘
📁 저장 구조 (DB 없음)
OpenBB는 관계형 DB 없이 JSON 파일과 선택적 캐싱을 사용합니다:

Code

~/.openbb_platform/
├── user_settings.json              ← 사용자 자격증명 & 설정
├── system_settings.json            ← 시스템 설정
└── [cache]/                        ← 선택사항 (Redis/SQLite/etc)

1️⃣ 사용자 설정 저장 (JSON 파일)
파일 위치:
    * macOS/Linux: ~/.openbb_platform/user_settings.json
    * Windows: C:\Users\<user>\.openbb_platform\user_settings.json
UserSettings 구조:

Python

class UserSettings(Tagged):
    credentials: Credentials        # API 키
    preferences: Preferences        # 사용자 설정
    defaults: Defaults             # 기본값
예시 (user_settings.json):

JSON

{
    "credentials": {
        "alpha_vantage_api_key": "YOUR_KEY_HERE",
        "fmp_api_key": "YOUR_KEY_HERE",
        "eia_api_key": "YOUR_KEY_HERE"
    },
    "preferences": {
        "data_provider": "fmp",
        "auto_select": true,
        "chart_type": "candlestick",
        "date_format": "YYYY-MM-DD"
    },
    "defaults": {
        "start_date": "2020-01-01",
        "end_date": null,
        "interval": "daily"
    }
}
로드 방식:

Python

class UserSettings:
    def __init__(self, **kwargs):
        # ① 파일 존재 확인
        if os.path.exists(USER_SETTINGS_PATH):
            # ② 파일에서 읽기
            with open(USER_SETTINGS_PATH) as f:
                file_settings = json.load(f)
            # ③ 파일 설정으로 초기화
            super().__init__(**file_settings)
        else:
            # ④ 기본값으로 초기화
            super().__init__(**kwargs)

2️⃣ 요청 결과 캐싱 (HTTP 캐시 - 선택사항)
aiohttp-client-cache 라이브러리 사용:

Python

# 지원 캐시 백엔드
- Redis             # 분산 캐시 (프로덕션 권장)
- SQLite            # 로컬 파일 기반 캐시
- MongoDB           # NoSQL 캐시
- DynamoDB          # AWS 캐시
- Filesystem        # 로컬 파일 캐시
- Memory            # 인메모리 캐시
캐시 활성화:

Python

# Fetcher 레벨에서 use_cache 플래그 지원
params = {
    "symbol": "AAPL",
    "use_cache": True,          # ← 캐시 사용
    "cache_backend": "redis",   # ← 백엔드 선택
}

# 캐시 Key 생성
cache_key = f"{provider}_{model}_{hash(params)}"
# 예: "fmp_EquityHistorical_abc123def456"

# 캐시 TTL (Time To Live)
# 기본: 24시간 (86400초)

3️⃣ 세션 메모리 (임시 저장)
OBBject 메모리 저장:

Python

class OBBject(Tagged, Generic[T]):
    results: T | None              # 실제 데이터 (메모리)
    provider: str | None           # 제공자 이름
    warnings: list[Warning_] | None  # 경고
    chart: Chart | None            # 차트 객체
    extra: dict[str, Any]          # 메타데이터
    
    # Private attributes (메모리에만)
    _route: str                    # 라우트 경로
    _standard_params: dict         # 표준 파라미터
    _extra_params: dict            # Extra 파라미터
특징:
    * 서버 재시작 시 소실됨 (영구 저장 안 함)
    * 세션 동안만 유효
    * 추가 변환/조작에 사용

저장 메커니즘 요약표
				
				
				
				
항목	저장 위치	타입	지속성	목적
자격증명	~/.openbb_platform/user_settings.json	JSON 파일	✅ 영구	API 키 관리
사용자가 설정 저장하는 방법
방법 1: 프로그래밍 방식

Python

from openbb import obb

# 자격증명 설정
obb.user.credentials.fmp_api_key = "YOUR_KEY"
obb.user.credentials.save()  # 자동으로 JSON 저장

# 선호도 설정
obb.user.preferences.data_provider = "fmp"
obb.user.preferences.save()
방법 2: 파일 직접 편집

JSON

# ~/.openbb_platform/user_settings.json
{
    "credentials": {
        "fmp_api_key": "YOUR_KEY"
    },
    "preferences": {
        "data_provider": "fmp"
    }
}
방법 3: 환경 변수 설정

bash

export FMP_API_KEY="YOUR_KEY"
export ALPHA_VANTAGE_API_KEY="YOUR_KEY"
방법 4: OpenBB Hub (클라우드 동기화)

Code

https://my.openbb.co/app/platform/credentials
→ 자격증명 등록 → 클라우드 저장 → 로컬 앱에서 동기화

페이지 로드 및 화면 관리
1️⃣ 백엔드 시작

bash

# FastAPI 서버 시작
openbb-api

# 또는 uvicorn 직접 실행
uvicorn openbb_core.api.main:app --host 0.0.0.0 --port 6900

# 또는 Python에서
from openbb_core.api.main import app
import uvicorn

uvicorn.run(app, host="0.0.0.0", port=6900)
서버 초기화:
    1. 확장 로드 (ExtensionLoader)
    2. Provider 레지스트리 구성 (RegistryLoader)
    3. 라우터 생성 (RouterLoader)
    4. FastAPI 앱 구성
    5. 포트 6900에서 수신 대기

2️⃣ Desktop App 초기화

TypeScript

// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Tauri 초기화
import { invoke } from '@tauri-apps/api/core'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Backend 상태 확인
const backendStatus = await invoke('get_backend_status')
console.log('Backend:', backendStatus)
Desktop App 구성:
    * Tauri: Rust 기반 데스크톱 프레임워크
    * React: UI 프레임워크
    * Vite: 빌드 도구

3️⃣ 사용자 설정 로드

TypeScript

// Desktop에서 사용자 설정 로드
async function loadUserSettings() {
  const settings = await invoke('load_user_settings')
  // {
  //   credentials: { fmp_api_key: "..." },
  //   preferences: { data_provider: "fmp" }
  // }
  return settings
}
로드된 설정 사용:
    1. 자격증명 메모리에 저장 (보안)
    2. 선호도 UI에 적용
    3. 기본값으로 폼 채우기

4️⃣ 명령 전송 (API 요청)

TypeScript

// React 컴포넌트에서 API 요청
async function queryHistoricalData(symbol: string) {
  const response = await fetch(
    'http://127.0.0.1:6900/api/v1/equity/price/historical',
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      params: {
        provider: 'fmp',
        symbol: symbol,
        start_date: '2024-01-01',
      },
    }
  )
  return await response.json()
}
요청 흐름:
    1. 사용자 입력 → 파라미터 수집
    2. HTTP 요청 생성 → Backend API 호출
    3. JSON 파라미터 전달
    4. 서버 처리 대기

5️⃣ 결과 수신 및 렌더링

TypeScript

// API 응답 처리
interface OBBjectResponse {
  results: any[]
  provider: string
  warnings: string[]
  chart: any | null
  extra: Record<string, any>
}

async function displayResults(symbol: string) {
  const data: OBBjectResponse = await queryHistoricalData(symbol)
  
  // ① 테이블 데이터 준비
  const tableData = data.results.map(row => ({
    date: row.date,
    open: row.open.toFixed(2),
    close: row.close.toFixed(2),
    volume: row.volume.toLocaleString(),
  }))
  
  // ② 차트 데이터 준비
  const chartData = {
    x: data.results.map(r => r.date),
    y: data.results.map(r => r.close),
  }
  
  // ③ UI 업데이트
  setTableData(tableData)
  setChartData(chartData)
}

Desktop UI 주요 화면
화면 1: Backend 관리

TypeScript

// components/BackendManager.tsx
interface BackendService {
  id: string
  name: string
  status: 'running' | 'stopped' | 'starting'
  pid?: number
  apiUrl?: string
}

export function BackendManager() {
  const [backends, setBackends] = useState<BackendService[]>([])
  
  // Backend 시작/중지
  async function toggleBackend(id: string) {
    await invoke('toggle_backend', { backendId: id })
  }
  
  // 로그 보기
  function viewLogs(id: string) {
    // Backend 로그 창 열기
  }
}
화면 2: 데이터 테이블

TypeScript

// components/DataTable.tsx
export function DataTable({ data }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Open</th>
          <th>High</th>
          <th>Low</th>
          <th>Close</th>
          <th>Volume</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            <td>{row.date}</td>
            <td>${row.open}</td>
            <td>${row.high}</td>
            <td>${row.low}</td>
            <td>${row.close}</td>
            <td>{row.volume.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
화면 3: 차트 뷰

TypeScript

// components/ChartView.tsx
import { LineChart, Line, XAxis, YAxis } from 'recharts'

export function ChartView({ data }) {
  return (
    <LineChart width={800} height={400} data={data}>
      <XAxis dataKey="date" />
      <YAxis />
      <Line type="monotone" dataKey="close" stroke="#8884d8" />
    </LineChart>
  )
}

사용자 흐름 예제
예제 1: Python SDK 사용

Python

# 1단계: OpenBB 임포트 및 초기화
from openbb import obb

# 자동으로 ~/.openbb_platform/user_settings.json 로드됨

# 2단계: 데이터 조회
result = obb.equity.price.historical(
    symbol="AAPL",
    start_date="2024-01-01",
    provider="fmp",  # Optional: 기본값은 user_settings에서
)

# 내부 처리 흐름:
# [1] Router → @router.command(model="EquityHistorical") 매칭
# [2] Query 객체 생성
#     - CommandContext: 사용자 설정 로드
#     - ProviderChoices: provider="fmp" 설정
#     - StandardParams: symbol, start_date 설정
# [3] Query.execute() 호출
#     - Provider 레지스트리에서 "fmp" Provider 조회
#     - fetcher_dict에서 "EquityHistorical" Fetcher 조회
#     - 자격증명 필터링 (fmp_api_key)
# [4] FMPEquityHistoricalFetcher.fetch_data() 실행
#     - transform_query(): 파라미터 변환
#     - aextract_data(): API 호출
#     - transform_data(): 데이터 변환
# [5] OBBject 생성 및 반환

# 3단계: 결과 처리
print(result)
# → OBBject
#    results: List[EquityHistoricalData]
#    provider: "fmp"
#    warnings: []

# 4단계: 데이터 변환
df = result.to_dataframe()          # Pandas DataFrame
print(df.head())
#           Date    Open    High     Low   Close      Volume
# 0  2024-01-01  150.25  152.50  149.75  151.80  50000000.0
# 1  2024-01-02  151.80  153.25  151.00  152.50  48000000.0
# ...

# 5단계: 추가 분석
json_data = result.to_json()        # JSON 문자열
dict_data = result.to_dict()        # Python Dictionary
numpy_array = result.to_numpy()     # NumPy Array

# 6단계: 차트 표시
result.show()                       # Plotly 대시보드

예제 2: REST API 사용
서버 시작:

bash

openbb-api
# FastAPI 서버 시작 @ http://127.0.0.1:6900
HTTP 요청:

bash

curl -X GET \
  "http://127.0.0.1:6900/api/v1/equity/price/historical" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "fmp",
    "symbol": "AAPL",
    "start_date": "2024-01-01"
  }'
응답 (JSON):

JSON

{
    "results": [
        {
            "date": "2024-01-01",
            "open": 150.25,
            "high": 152.50,
            "low": 149.75,
            "close": 151.80,
            "volume": 50000000
        },
        {
            "date": "2024-01-02",
            "open": 151.80,
            "high": 153.25,
            "low": 151.00,
            "close": 152.50,
            "volume": 48000000
        }
    ],
    "provider": "fmp",
    "warnings": [],
    "chart": null,
    "extra": {}
}
Python에서 API 호출:

Python

import requests

response = requests.get(
    "http://127.0.0.1:6900/api/v1/equity/price/historical",
    params={
        "provider": "fmp",
        "symbol": "AAPL",
        "start_date": "2024-01-01",
    }
)

data = response.json()
print(data['results'])

예제 3: Desktop App 사용자 흐름

Code

1️⃣ 앱 시작
   └─ Tauri 윈도우 열기
   └─ React 앱 렌더링
   └─ Backend 상태 확인

2️⃣ Backend 연결
   └─ "Backends" 탭 → Backend 선택
   └─ "Start" 버튼 클릭
   └─ Status: "starting" → "running"

3️⃣ API 키 설정
   └─ "Settings" → "API Keys"
   └─ "fmp_api_key" 입력
   └─ "Save" 버튼
   └─ ~/.openbb_platform/user_settings.json 저장

4️⃣ 데이터 조회
   └─ "Equity" 탭 → "Price" → "Historical"
   └─ Symbol: "AAPL" 입력
   └─ Start Date: "2024-01-01" 선택
   └─ Provider: "fmp" (기본값)
   └─ "Query" 버튼 클릭

5️⃣ 로딩
   └─ HTTP GET /api/v1/equity/price/historical
   └─ Backend 처리 (Fetcher 실행)
   └─ 로딩 스피너 표시

6️⃣ 결과 표시
   └─ 테이블 탭: 데이터 테이블
   └─ 차트 탭: 캔들스틱 차트
   └─ 메타 탭: Provider, 시간 정보

소스 코드 흐름순 정리표
				
				
				
				
				
				
				
				
				
				
#	단계	파일	클래스/함수	설명
1	사용자 호출	command_runner.py	CommandRunner.run()	사용자가 명령 호출
2	라우팅	router.py	@Router.command()	엔드포인트 등록
3	서명 검증	router.py	SignatureInspector.complete()	함수 서명 검증
4	의존성 주입	router.py	SignatureInspector.inject_dependency()	파라미터 주입
5	Query 생성	query.py	Query.__init__()	쿼리 객체 생성
6	파라미터 필터링	query.py	Query.filter_extra_params()	지원 파라미터만 필터링
7	Query 실행	query.py	Query.execute()	QueryExecutor 호출
8	Provider 조회	query_executor.py	QueryExecutor.get_provider()	Registry에서 조회
제약사항 및 확장
현재 제약사항
			
			
			
			
			
			
			
추천 확장 옵션
1️⃣ PostgreSQL 데이터 저장소 추가
사용 사례:
    * 장기 데이터 저장
    * 분석 결과 히스토리
    * 사용자별 데이터 분리
구현 예시:

Python

# extensions/database/models.py
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()

class QueryResult(Base):
    __tablename__ = "query_results"
    
    id: int
    route: str
    params: dict
    results: list
    provider: str
    created_at: datetime
    
    def save(self, session):
        session.add(self)
        session.commit()
2️⃣ Redis 기반 분산 캐싱
사용 사례:
    * 멀티 인스턴스 배포
    * 결과 캐시 공유
    * 고속 응답
구현 예시:

Python

# Redis 설정
import redis

redis_client = redis.Redis(
    host='localhost',
    port=6379,
    db=0,
    decode_responses=True
)

# 캐시 저장
cache_key = f"{provider}:{model}:{hash(params)}"
redis_client.setex(cache_key, 86400, json.dumps(results))

# 캐시 조회
cached = redis_client.get(cache_key)
3️⃣ 사용자 포트폴리오 시스템
사용 사례:
    * 자산 관리
    * 성과 추적
    * 포트폴리오 분석
구현 예시:

Python

# extensions/portfolio/models.py
class Portfolio:
    user_id: str
    name: str
    holdings: list[Holding]
    
    def add_holding(self, symbol, quantity, cost):
        pass
    
    def calculate_performance(self):
        pass

class Holding:
    symbol: str
    quantity: float
    cost: float
    current_price: float

OpenBB Pro/Workspace vs Community
			
			
			
			
			
			
			
			
			
			
			
			
결론
OpenBB Platform 아키텍처의 핵심

Code

✅ 강점:
├─ 간결하고 모듈화된 설계
├─ Stateless 아키텍처 (확장성)
├─ 비동기 처리 (높은 성능)
├─ Provider 기반 확장 (새로운 데이터 소스 추가 용이)
├─ 다중 인터페이스 (Python/API/CLI/Desktop)
├─ 표준화된 데이터 모델
└─ 선택적 캐싱 (Redis/SQLite/etc)

⚠️ 한계:
├─ DB 미지원 (기본)
├─ 데이터 영구 저장 불가
├─ 단일 사용자 (로컬 JSON)
├─ 쿼리 히스토리 미지원
├─ 포트폴리오 관리 미지원
└─ 실시간 데이터 미지원

→ 엔터프라이즈 기능이 필요한 경우 OpenBB Pro/Workspace 권장
아키텍처 설계 철학
    1. "Connect Once, Consume Everywhere"
        * 한 번 API 키를 설정하면 모든 인터페이스에서 사용
    2. "Fetch, Transform, Deliver"
        * 3단계 Fetcher 파이프라인
        * 각 Provider의 독립적인 구현
    3. "Standard Interface, Flexible Implementation"
        * 모든 Provider가 동일한 인터페이스
        * Provider별 특수 기능은 ExtraParams로 처리
    4. "Extensibility First"
        * EntryPoint 기반 동적 로드
        * 새로운 Provider/Router 추가 간편

참고 자료
공식 문서
    * OpenBB 공식 문서
    * Python 개발자 가이드
    * CLI 설치 가이드
GitHub
    * OpenBB 저장소
    * Issue 추적
    * Discussion
커뮤니티
    * Discord 서버
    * Twitter

작성: GitHub Copilot 작성일: 2026-05-20 버전: 1.0 라이선스: AGPLv3 (OpenBB와 동일)

Code

이 문서를 다음과 같이 저장하세요:

## 📥 저장 방법

### **1. Markdown으로 저장**
```bash
# ARCHITECTURE_GUIDE.md 파일 생성 후 전체 내용 붙여넣기
cat > ARCHITECTURE_GUIDE.md << 'EOF'
[위 마크다운 전체 내용]
EOF
2. PDF로 변환 (Pandoc 사용)

bash

# Pandoc 설치 (맥)
brew install pandoc

# Markdown → PDF 변환
pandoc ARCHITECTURE_GUIDE.md -o ARCHITECTURE_GUIDE.pdf

# 한글 지원 (필요시)
pandoc ARCHITECTURE_GUIDE.md -o ARCHITECTURE_GUIDE.pdf \
  --pdf-engine=xelatex \
  -V mainfont="Noto Sans CJK KR"
3. Word로 변환

bash

pandoc ARCHITECTURE_GUIDE.md -o ARCHITECTURE_GUIDE.docx
4. HTML로 변환

bash

pandoc ARCHITECTURE_GUIDE.md -o ARCHITECTURE_GUIDE.html

완벽한 아키텍처 가이드 문서가 준비되었습니다! 🎉
필요시 추가 수정이나 다른 형식으로의 변환이 필요하면 말씀해주세요!
