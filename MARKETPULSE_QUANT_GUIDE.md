# OpenBB Quantitative 분석 — MarketPulse 연동 가이드

> 작성일: 2026-04-23
> 환경: Python 3.12, OpenBB 4.7.1, openbb-core 1.6.8, openbb-quantitative 1.5.0

---

## 전체 흐름 요약

```
[OpenBB Quantitative Extension]
        ↓  POST (데이터 직접 주입 방식 → 위젯 불가)
[커스텀 FastAPI 백엔드]  ← 내부적으로 yfinance로 데이터 fetch
        ↓  GET + /widgets.json (위젯 등록 방식)
[OpenBB Workspace]
        ↓  브라우저 UI에서 파라미터 입력 → 분석 결과 테이블/차트
```

---

## 1. 왜 커스텀 백엔드가 필요한가

OpenBB의 Quantitative 엔드포인트는 **POST** 방식으로, 분석할 데이터를 request body에 직접 넘겨야 합니다.

```
POST /api/v1/quantitative/summary?target=close
Body: [{"date": "2024-01-01", "close": 185.0}, ...]
```

OpenBB Workspace의 위젯은 **GET** 방식만 지원하므로, 자동 위젯 등록이 되지 않습니다.

**해결책:** ticker + 날짜를 GET 파라미터로 받아서 내부에서 데이터를 fetch하고 분석까지 수행하는 별도 FastAPI 서버를 만들어 위젯으로 등록합니다.

---

## 2. 환경 설정

### 2-1. 패키지 설치

```bash
pip install "openbb[all]"
pip install openbb-quantitative
```

### 2-2. openbb static 패키지 빌드 (최초 1회)

openbb-core 버전 업그레이드 후 반드시 실행해야 합니다.
실행하지 않으면 `ImportError: cannot import name 'OBBject_EquityInfo'` 에러가 발생합니다.

```python
import openbb
openbb.build()
```

### 2-3. provider_interface 패치 (openbb-core 1.6.x 버그 대응)

openbb-core 1.6.x에서 동적 생성 모델(`OBBject_EquityInfo` 등)이 모듈 네임스페이스에 노출되지 않는 버그가 있습니다.
`openbb_core/app/provider_interface.py`의 `_generate_return_annotations` 메서드 마지막 `return annotations` 직전에 아래 코드를 추가합니다.

```python
# 동적 생성 OBBject_* 클래스를 모듈 네임스페이스에 등록
import sys as _sys
_module = _sys.modules[__name__]
for _name, _cls in annotations.items():
    setattr(_module, f"OBBject_{_name}", _cls)
```

> **파일 위치:** `site-packages/openbb_core/app/provider_interface.py`
> 이 패치 없이는 `from openbb import obb` 자체가 실패합니다.

---

## 3. OpenBB API 서버 실행

### 기본 실행 (포트 6900)

```bash
openbb-api
# 또는 전체 경로로:
C:/Users/TRIA/AppData/Local/Programs/Python/Python312/Scripts/openbb-api.exe
```

- URL: `http://127.0.0.1:6900`
- 문서: `http://127.0.0.1:6900/docs`
- 로그: `logs/openbb-api.log` 로 남기려면 `| tee logs/openbb-api.log` 추가

### HTTPS 실행 (OpenBB Workspace 연동 시 필요할 수 있음)

```bash
# 1. 자체 서명 인증서 생성 (최초 1회)
python -c "
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
import ipaddress, datetime

key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
subject = issuer = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, '127.0.0.1')])
cert = (x509.CertificateBuilder()
    .subject_name(subject).issuer_name(issuer)
    .public_key(key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(datetime.datetime.now(datetime.UTC))
    .not_valid_after(datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=365))
    .add_extension(x509.SubjectAlternativeName([x509.IPAddress(ipaddress.IPv4Address('127.0.0.1'))]), critical=False)
    .sign(key, hashes.SHA256()))
open('certs/cert.pem','wb').write(cert.public_bytes(serialization.Encoding.PEM))
open('certs/key.pem','wb').write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
print('Done')
"

# 2. HTTPS로 실행 (포트 443은 관리자 권한 필요 → 8443 사용)
python -m uvicorn openbb_core.api.rest_api:app \
  --host 127.0.0.1 --port 8443 \
  --ssl-certfile certs/cert.pem \
  --ssl-keyfile certs/key.pem
```

> 브라우저에서 `https://127.0.0.1:8443` 접속 후 인증서 수락 필요

---

## 4. Quantitative 분석 — Python SDK 사용법

```python
from openbb import obb

# 데이터 가져오기
data = obb.equity.price.historical("AAPL", provider="yfinance", start_date="2023-01-01")

# 기술통계 요약
summary = obb.quantitative.summary(data.results, target="close")
print(summary.to_df())

# 정규성 검정 (Jarque-Bera, Shapiro-Wilk, KS 등)
normality = obb.quantitative.normality(data.results, target="close")

# CAPM (베타, 체계적/비체계적 위험)
capm = obb.quantitative.capm(data.results, target="close")

# 롤링 샤프 비율
sharpe = obb.quantitative.performance.sharpe_ratio(data.results, target="close", window=21)

# 롤링 소르티노 비율
sortino = obb.quantitative.performance.sortino_ratio(data.results, target="close", window=21)

# 롤링 표준편차 (변동성)
stdev = obb.quantitative.rolling.stdev(data.results, target="close", window=21)

# 롤링 평균
mean = obb.quantitative.rolling.mean(data.results, target="close", window=21)
```

> **주의:** `window` 값은 데이터 길이보다 작아야 합니다.
> 기본값 252(1년)를 사용할 경우 최소 253일치 데이터가 필요합니다.

---

## 5. 커스텀 Quantitative 백엔드 (위젯 연동용)

### 5-1. 핵심 구조

```
quantitative_backend/
└── main.py      ← FastAPI 앱 (포트 7000)
```

### 5-2. 엔드포인트 목록

| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/summary` | 기술통계 요약 |
| GET | `/normality` | 정규성 검정 5종 |
| GET | `/capm` | CAPM 분석 |
| GET | `/sharpe` | 롤링 샤프 비율 (최근 60일) |
| GET | `/rolling/stdev` | 롤링 표준편차 (최근 60일) |
| GET | `/widgets.json` | OpenBB Workspace 위젯 정의 |

### 5-3. 공통 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `symbol` | string | ✅ | - | 종목 티커 (예: AAPL) |
| `target` | string | | `close` | 분석할 컬럼명 |
| `start_date` | date | | - | 시작일 (YYYY-MM-DD) |
| `end_date` | date | | - | 종료일 (YYYY-MM-DD) |
| `window` | int | | `21` | 롤링 윈도우 크기 (sharpe/stdev) |

### 5-4. 실행

```bash
python quantitative_backend/main.py
# → http://127.0.0.1:7000 에서 실행
```

### 5-5. 응답 형식 예시

**`/summary?symbol=AAPL&start_date=2024-01-01`**
```json
{
  "results": [
    {"metric": "count", "value": 578.0},
    {"metric": "mean",  "value": 225.06},
    {"metric": "std",   "value": 30.37},
    {"metric": "min",   "value": 165.0},
    {"metric": "max",   "value": 286.19},
    {"metric": "p_25",  "value": 201.51},
    {"metric": "p_50",  "value": 226.43},
    {"metric": "p_75",  "value": 249.24}
  ]
}
```

**`/normality?symbol=AAPL`**
```json
{
  "results": [
    {"test": "kurtosis",           "statistic": -9.722, "p_value": 2.42e-22, "normal": false},
    {"test": "skewness",           "statistic":  1.467, "p_value": 0.142,    "normal": true},
    {"test": "jarque_bera",        "statistic": 28.53,  "p_value": 6.37e-7,  "normal": false},
    {"test": "shapiro_wilk",       "statistic":  0.975, "p_value": 1.23e-10, "normal": false},
    {"test": "kolmogorov_smirnov", "statistic":  1.0,   "p_value": 0.0,      "normal": false}
  ]
}
```

---

## 6. OpenBB Workspace 위젯 등록

### `/widgets.json` 구조 (핵심 필드)

```json
{
  "widget_id": {
    "name": "위젯 이름",
    "description": "설명",
    "category": "Quantitative",
    "type": "table | chart",
    "widgetId": "widget_id",
    "endpoint": "/엔드포인트",
    "params": [...],
    "data": {
      "dataKey": "results",
      "table": { "columnsDefs": [...] }
    },
    "gridData": { "w": 20, "h": 12 }
  }
}
```

### Workspace 연결 방법

1. OpenBB Workspace → **Apps** 탭
2. **Connect Backend** 클릭
3. 입력:
   - **Name:** `Quantitative Analysis`
   - **URL:** `http://127.0.0.1:7000`
4. **Test** → **Add**

연결 후 위젯 검색창에서 `Quantitative` 로 필터링하면 5개 위젯이 나타납니다.

---

## 7. MarketPulse 적용 시 확장 포인트

### 추가할 수 있는 분석

```python
# 오메가 비율
obb.quantitative.performance.omega_ratio(data.results, target="close")

# 단위근 검정 (ADF)
obb.quantitative.unitroot_test(data.results, target="close")

# 롤링 분위수
obb.quantitative.rolling.quantile(data.results, target="close", window=21, quantile_pct=0.75)

# 롤링 첨도/왜도
obb.quantitative.rolling.kurtosis(data.results, target="close", window=21)
obb.quantitative.rolling.skew(data.results, target="close", window=21)
```

### 다중 종목 비교 패턴

```python
symbols = ["AAPL", "MSFT", "GOOGL"]
results = {}
for sym in symbols:
    data = obb.equity.price.historical(sym, provider="yfinance", start_date="2024-01-01").results
    results[sym] = obb.quantitative.performance.sharpe_ratio(data, target="close", window=21).to_df()
```

### 커스텀 백엔드 확장 패턴

```python
# main.py에 새 엔드포인트 추가
@app.get("/omega")
def omega_ratio(symbol: str, target: str = "close", window: int = 21, ...):
    data = fetch_data(symbol, start_date, end_date)
    result = obb.quantitative.performance.omega_ratio(data, target=target, window=window)
    # ... 응답 가공
```

`/widgets.json`의 dict에 새 위젯 정의만 추가하면 Workspace에 자동으로 나타납니다.

---

## 8. 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `ImportError: OBBject_EquityInfo` | openbb-core 버전 충돌 | provider_interface.py 패치 적용 |
| `openbb-api` 명령어 없음 | PATH 미등록 | 전체 경로로 실행 (`Scripts/openbb-api.exe`) |
| `Window > data length` | 윈도우 > 데이터 개수 | `start_date` 범위 늘리거나 `window` 줄이기 |
| Workspace 연결 실패 (CORS) | CORS 미설정 | `allow_origins=["*"]` 확인 |
| Workspace 연결 실패 (Mixed Content) | HTTP → HTTPS 차단 | HTTPS 인증서 생성 후 8443 포트 사용 |
| `openbb-api.exe` 파일 잠김 | 실행 중 pip 업그레이드 시도 | 서버 종료 후 업그레이드 |
