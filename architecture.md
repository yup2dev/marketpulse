📐 OpenBB Platform - Application Architecture 분석
1단계: 사용자 호출 (Python/API)
Code
사용자
  ↓
obb.equity.price.historical("AAPL")
  ↓
CommandRunner.run(route, *args, **kwargs)
관련 코드:

%22https: / github.com / blob / 186cbb068c194fb11adc57bb492a75e474ef4103 / openbb_platform / core / openbb_core / app / query.py%22
class Query:
    def __init__(self, cc, provider_choices, standard_params, extra_params):
        self.provider = provider_choices.provider
        self.standard_params = standard_params
        self.extra_params = extra_params

2단계: 라우팅 및 명령 매핑
Code
Route (/equity/price/historical)
  ↓
Router.command() 데코레이터
  ↓
@router.command(model="EquityHistorical")
async def historical(...) -> OBBject
관련 코드:

%22https: / github.com / blob / 186cbb068c194fb11adc57bb492a75e474ef4103 / openbb_platform / core / openbb_core / app / router.py
class Router:
    def command(self, func, **kwargs):
        """명령 데코레이터 - 라우터에 엔드포인트 등록"""
        model = kwargs.pop("model", "")
        # 서명 검증 및 의존성 주입
        func = SignatureInspector.complete(func, model)
3단계: Fetcher 호출 흐름
Code
Query.execute()
  ↓
QueryExecutor.execute(provider, model, params, credentials)
  ↓
get_provider() → Provider 인스턴스 조회
  ↓
get_fetcher() → Fetcher 클래스 조회
  ↓
Fetcher.fetch_data(params, credentials)
관련 코드:

%22https: / github.com / blob / 186cbb068c194fb11adc57bb492a75e474ef4103 / openbb_platform / core / openbb_core / provider / query_executor.py
class QueryExecutor:
    async def execute(self, provider_name, model_name, params, credentials):
        provider = self.get_provider(provider_name)
        fetcher = self.get_fetcher(provider, model_name)
        filtered_credentials = self.filter_credentials(credentials, provider, fetcher.require_credentials)
        return await fetcher.fetch_data(params, filtered_credentials)
4단계: Fetcher 데이터 추출 (3단계 프로세스)
Code
Fetcher.fetch_data()
  │
  ├─ 1️⃣ transform_query() → 원본 파라미터 → Provider 특정 쿼리
  │
  ├─ 2️⃣ extract_data() / aextract_data() → API 호출 → Raw 데이터
  │
  └─ 3️⃣ transform_data() → Raw 데이터 → 표준 Data 모델
관련 코드:

%22https: / github.com / blob / 186cbb068c194fb11adc57bb492a75e474ef4103 / openbb_platform / core / openbb_core / provider / abstract / fetcher.py
class Fetcher(Generic[Q, R]):
    @staticmethod
    def transform_query(params: dict) -> Q:
        """파라미터를 Provider 특정 쿼리로 변환"""
        raise NotImplementedError

5단계: 데이터 저장 및 결과 반환
Code
Fetcher 결과
  ↓
AnnotatedResult[R] 또는 R
  ↓
OBBject.from_query() → OBBject 생성
  ↓
OBBject(results=data, provider=name, ...)
  ↓
사용자에게 반환
관련 코드:

%22https: / github.com / blob / 186cbb068c194fb11adc57bb492a75e474ef4103 / openbb_platform / core / openbb_core / app / model / obbject.py
v1
class OBBject(Tagged, Generic[T]):
    results: T | None = Field(default=None, description="Serializable results")
    provider: str | None = Field(default=None, description="Provider name")
    warnings: list[Warning_] | None = Field(default=None)
    chart: Chart | None = Field(default=None)
    extra: dict[str, Any] = Field(default_factory=dict)
6단계: 페이지 로드 및 화면 관리 (Desktop/UI)
Code
Desktop App (React/Tauri)
  ├─ Backend 서비스 시작
  │  └─ openbb-api (FastAPI @ 127.0.0.1:6900)
  │
  ├─ 데이터 요청
  │  └─ HTTP GET/POST → /api/v1/...
  │
  └─ 결과 렌더링
     ├─ OBBject 파싱
     ├─ 테이블/차트 표시
     └─ 로그 표시
관련 코드:

%22https: / github.com / blob / 186cbb068c194fb11adc57bb492a75e474ef4103 / desktop / src / routes / backends.tsx
v1
interface BackendService {
    id: string;
    name: string;
    status: "running" | "stopped" | "starting" | "stopping" | "error";
    pid?: number;
    apiUrl?: string;
📊 완전한 데이터 흐름 다이어그램
Code
┌─────────────────────────────────────────────────────────────────┐
│ 사용자 계층 (User Layer)                                          │
├─────────────────────────────────────────────────────────────────┤
│ Python CLI/SDK                          Desktop App (React)      │
│ obb.equity.price.historical("AAPL")     GUI Interface           │
└──────────┬──────────────────────────────┬────────────────────────┘
           │                              │
           └──────────────────┬───────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────┐
│ 라우팅 계층 (Routing Layer)                                      │
├──────────────────────────────────────────────────────────────┤
│ Router → @router.command(model="EquityHistorical")            │
│          ├─ CommandContext (사용자 설정, 자격증명)               │
│          ├─ ProviderChoices (provider 선택)                   │
│          ├─ StandardParams (공통 파라미터)                     │
│          └─ ExtraParams (Provider 특정 파라미터)              │
└──────────┬───────────────────────────────────────────────────┘
           │
┌──────────▼───────────────────────────────────────────────────┐
│ Query 실행 계층 (Query Execution Layer)                        │
├──────────────────────────────────────────────────────────────┤
│ Query.execute()                                              │
│   │
│   ├─ Provider 인터페이스 → 등록된 Provider 조회              │
│   ├─ Credentials 필터링                                      │
│   └─ QueryExecutor.execute() 호출                           │
└──────────┬───────────────────────────────────────────────────┘
           │
┌──────────▼───────────────────────────────────────────────────┐
│ Fetcher 계층 (Data Fetcher Layer)                             │
├──────────────────────────────────────────────────────────────┤
│ EquityHistoricalFetcher (예: Alpha Vantage)                 │
│   │
│   ├─ ① transform_query(params)                              │
│   │    {"symbol": "AAPL"} → {"symbol": "AAPL", ...}        │
│   │
│   ├─ ② extract_data(query, credentials)                    │
│   │    API Call → Raw JSON Data                            │
│   │
│   └─ ③ transform_data(query, raw_data)                     │
│        Raw Data → List[EquityHistoricalData]               │
└──────────┬───────────────────────────────────────────────────┘
           │
┌──────────▼───────────────────────────────────────────────────┐
│ 저장 계층 (Storage/Caching Layer)                              │
├──────────────────────────────────────────────────────────────┤
│ Optional Cache (Redis/LocalStorage)                         │
│ - use_cache 플래그에 따라 결과 캐시                           │
└──────────┬───────────────────────────────────────────────────┘
           │
┌──────────▼───────────────────────────────────────────────────┐
│ 결과 모델 계층 (Result Model Layer)                            │
├──────────────────────────────────────────────────────────────┤
│ OBBject[List[EquityHistoricalData]]                         │
│   │
│   ├─ results: List[EquityHistoricalData]                   │
│   ├─ provider: "alpha_vantage"                             │
│   ├─ warnings: []                                          │
│   ├─ chart: Chart (선택사항)                               │
│   └─ extra: {metadata, ...}                                │
└──────────┬───────────────────────────────────────────────────┘
           │
           └─────────┬──────────────────────────────┬──────────┐
                     │                              │          │
        ┌────────────▼─────────────┐    ┌──────────▼──────────┐
        │ Python 반환              │    │ API JSON Response   │
        ├────────────────────────┤    ├────────────────────┤
        │ .to_dataframe()        │    │ FastAPI Response   │
        │ .to_dict()             │    │ Status: 200 OK     │
        │ .to_json()             │    │                    │
        └────────────────────────┘    └────────────────────┘
                     │                         │
                     └────────────┬────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │ 화면 렌더링 (UI Rendering) │
                    ├──────────────────────────┤
                    │ ✓ 테이블 표시            │
                    │ ✓ 차트 시각화            │
                    │ ✓ 로그 표시              │
                    │ ✓ 메타데이터 표시        │
                    └──────────────────────────┘
🔄 소스 흐름순 상세 정리
#	단계	파일/클래스	메서드/함수	설명
1	사용자 호출	command_runner.py	run(route)	사용자가 CLI/SDK/API로 명령 호출
2	라우팅	router.py	@Router.command()	엔드포인트 등록, 의존성 주입
3	서명 검증	router.py	SignatureInspector.complete()	함수 시그니처 검증 및 타입 체크
4	쿼리 생성	query.py	Query.__init__()	CommandContext, Provider, Params 조합
5	쿼리 실행	query.py	Query.execute()	Provider Interface 조회, Executor 생성
6	Provider 조회	query_executor.py	get_provider()	Registry에서 Provider 인스턴스 검색
7	Fetcher 조회	query_executor.py	get_fetcher()	Provider의 fetcher_dict에서 Fetcher 클래스 검색
8	자격증명 필터링	query_executor.py	filter_credentials()	Provider 요구사항에 맞는 자격증명 필터링
9	데이터 추출	fetcher.py	fetch_data()	3단계 Fetcher 파이프라인 실행
9-1	파라미터 변환	fetcher.py	transform_query()	표준 파라미터 → Provider 특정 쿼리 변환
9-2	API 호출	fetcher.py	extract_data()	외부 API 호출, Raw 데이터 수신
9-3	데이터 변환	fetcher.py	transform_data()	Raw 데이터 → 표준 Data 모델 변환
10	결과 생성	obbject.py	from_query()	결과를 OBBject 래퍼로 감싸기
11	응답 반환	api/router/commands.py	FastAPI 엔드포인트	JSON/DataFrame/OBBject 반환
12	UI 렌더링	desktop/src/	React 컴포넌트	테이블/차트 표시
💾 저장 메커니즘
캐싱 전략
Python
# Fetcher 레벨에서 캐시 처리
params = {
    "symbol": "AAPL",
    "use_cache": True,  # 캐시 사용 여부
    "start_date": "2024-01-01"
}

# Cache Key 생성: provider + model + params 조합
cache_key = f"{provider}_{model}_{hash(params)}"
상태 저장
Python
# OBBject에서 메타데이터 저장
OBBject(
    results=data,
    extra={
        "results_metadata": {...},  # 추가 메타데이터
        "timestamp": datetime.now(),
        "cache_key": "..."
    }
)
🖥️ 화면 관리 방법
페이지 로드 순서
Backend 시작 → FastAPI 서버 시작 (6900 포트)
Workspace 접속 → Desktop App 초기화
명령 전송 → HTTP 요청 → API 엔드포인트
결과 수신 → OBBject JSON 파싱
렌더링 → 테이블/차트/로그 표시
%22https: / github.com / blob / 186cbb068c194fb11adc57bb492a75e474ef4103 / openbb_platform / core / openbb_core / api / router / commands.py%22
# API 엔드포인트 예시
@router.post("/api/v1/equity/price/historical")
async def historical(
    provider: str,
    symbol: str,
    start_date: str = None,
이것이 OpenBB Platform의 완전한 Application Architecture입니다! 🎯