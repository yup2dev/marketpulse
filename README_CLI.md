# MarketPulse CLI - Terminal-Based Financial Analysis Tool

터미널에서 실행하는 주식 재무지표 분석 도구입니다. OpenBB Platform 스타일의 CLI 기반 인터페이스를 제공합니다.

## Features

- **재무지표 수집**: Yahoo Finance API를 통한 실시간 데이터 수집
- **차트 생성**: matplotlib 기반 고품질 PNG 차트 생성
- **터미널 출력**: 모든 작업을 터미널에서 완료
- **데이터베이스**: SQLite 기반 로컬 데이터 저장

## Installation

```bash
pip install -r requirements.txt
```

필수 패키지:
- matplotlib
- numpy
- pandas
- sqlalchemy
- yfinance

## Usage

### 1. 재무지표 수집 (Fetch)

특정 종목의 재무지표를 수집하고 데이터베이스에 저장합니다.

```bash
python scripts/financial_cli.py fetch AAPL
```

출력 예시:
```
============================================================
  AAPL - Apple Inc.
============================================================
부채/자산 비율:  0.32
부채/자본 비율:  1.73
유동비율:        0.98
ROE:             1.47
ROA:             0.27
순이익률:        0.25
PER:             29.50
PBR:             46.20
시가총액:        2987234000000
============================================================
```

### 2. 재무지표 비교 차트 (Chart)

여러 종목의 특정 재무지표를 비교하는 막대 차트를 생성합니다.

```bash
python scripts/financial_cli.py chart AAPL,MSFT,GOOGL --metric debt_to_asset
```

사용 가능한 지표:
- `debt_to_asset`: 부채/자산 비율
- `debt_to_equity`: 부채/자본 비율
- `current_ratio`: 유동비율
- `roe`: ROE (자기자본이익률)
- `roa`: ROA (총자산이익률)
- `profit_margin`: 순이익률
- `pe_ratio`: PER (주가수익비율)
- `pb_ratio`: PBR (주가순자산비율)

출력:
```
============================================================
  Chart saved successfully!
============================================================
Tickers: AAPL, MSFT, GOOGL
Metric:  debt_to_asset
File:    output/comparison_debt_to_asset_20251113_143022.png
============================================================
```

### 3. 재무건전성 레이더 차트 (Radar)

특정 종목의 재무건전성을 다각도로 분석한 레이더 차트를 생성합니다.

```bash
python scripts/financial_cli.py radar AAPL
```

분석 항목:
- 수익성 (ROE 기반)
- 안정성 (부채비율 기반)
- 유동성 (유동비율 기반)
- 성장성 (ROA 기반)
- 밸류에이션 (PER 기반)

### 4. 신용 스프레드 차트 (CDS)

신용 스프레드 지표 (CDS 프리미엄 대리 지표)를 시각화합니다.

```bash
python scripts/financial_cli.py cds
```

지표:
- High Yield ETF (HYG)
- Investment Grade ETF (LQD)
- VIX (변동성 지수)

## Output

모든 차트는 `output/` 디렉토리에 PNG 형식으로 저장됩니다.

```
output/
├── comparison_debt_to_asset_20251113_143022.png
├── radar_AAPL_20251113_143130.png
└── credit_spread_20251113_143245.png
```

## Database

재무지표 데이터는 `data/marketpulse.db` SQLite 데이터베이스에 저장됩니다.

### 주요 테이블

- `MBS_IN_FINANCIAL_METRICS`: 재무지표 데이터
- `MBS_IN_STOCK_PRICE`: 주가 데이터
- `MBS_IN_MARKET_INDEX`: 시장 지수 데이터

## Additional Scripts

### 데이터베이스 초기화

```bash
python scripts/reset_db.py
```

### 시장 데이터 로드

```bash
python scripts/load_market_data.py
```

### ETL 매핑 로드

```bash
python scripts/load_etl_mapping.py
```

## Architecture

```
index_analyzer/
├── app/
│   ├── models/          # 데이터베이스 모델
│   └── services/        # 비즈니스 로직
│       ├── chart_generator.py      # 차트 생성 (matplotlib)
│       ├── financial_fetcher.py    # 재무데이터 수집
│       ├── yahoo_finance_fetcher.py
│       └── stock_analyzer.py
├── scripts/
│   └── financial_cli.py # CLI 메인 진입점
├── data/
│   └── marketpulse.db   # SQLite 데이터베이스
└── output/              # 차트 출력 디렉토리
```

## Development

프로젝트는 완전히 터미널 기반으로 작동하며, 웹 서버나 브라우저가 필요하지 않습니다.

### Key Technologies

- **matplotlib**: 차트 생성 (Agg 백엔드, GUI 불필요)
- **yfinance**: Yahoo Finance API 클라이언트
- **SQLAlchemy**: ORM 및 데이터베이스 관리
- **argparse**: CLI 인터페이스

## Examples

### 종합 분석 워크플로우

```bash
# 1. 데이터 수집
python scripts/financial_cli.py fetch AAPL
python scripts/financial_cli.py fetch MSFT
python scripts/financial_cli.py fetch GOOGL

# 2. 비교 분석
python scripts/financial_cli.py chart AAPL,MSFT,GOOGL --metric roe

# 3. 상세 분석
python scripts/financial_cli.py radar AAPL

# 4. 시장 상황 확인
python scripts/financial_cli.py cds
```

## Notes

- 모든 차트는 PNG 형식으로 저장되며 자동으로 브라우저를 열지 않습니다
- 차트 파일은 타임스탬프와 함께 저장되어 이력 관리가 가능합니다
- 한글 폰트(Malgun Gothic)를 지원하며, 없을 경우 기본 폰트를 사용합니다

## License

Internal use only
