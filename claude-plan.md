# MarketPulse - Macro Analysis Tab Requirements
## 기관 투자자급 매크로 분석 대시보드

---

## 📊 Executive Summary

기존 매크로 탭은 단순히 경제 지표를 나열하는 수준이었습니다.
전문 매크로 분석가의 관점에서, **데이터를 인사이트로 전환**하고 **투자 의사결정을 지원**하는 고급 분석 도구로 재설계합니다.

---

## 🎯 핵심 설계 원칙

1. **Context over Data**: 단순 숫자 나열이 아닌, 맥락과 의미 제공
2. **Actionable Insights**: 투자 결정에 직접 활용 가능한 분석
3. **Multi-layer Analysis**: 개별 지표 → 경기 사이클 → 자산 배분 전략
4. **Risk-Aware**: 항상 리스크와 기회를 동시에 평가
5. **Global Perspective**: 미국 중심이되 글로벌 맥락 고려

---

## 🏗️ 새로운 탭 구조

### 1. **Economic Regime Dashboard** (경기 국면 대시보드)
   **목적**: 현재 경제가 어느 국면에 있는지 한눈에 파악

   **핵심 요소**:
   - **Regime Indicator** (4분면 매트릭스)
     - X축: Growth (성장률) - GDP, 산업생산, 고용
     - Y축: Inflation (인플레이션) - CPI, PCE, 임금
     - 4개 국면: Goldilocks / Reflation / Stagflation / Deflation
     - 현재 위치 + 3개월/6개월 추세 벡터

   - **Economic Surprise Index**
     - 실제 경제지표 vs 컨센서스 예상치 차이
     - Positive/Negative surprise 누적 점수

   - **Leading vs Lagging Indicators Divergence**
     - 선행지표: ISM PMI, 소비자신뢰지수, 주택착공
     - 후행지표: 실업률, 기업투자
     - 괴리도 분석 → 경기 전환점 예측

   **시각화**:
   - 4분면 산점도 (시간 경과에 따른 이동 경로)
   - Heatmap (각 지표의 강도)
   - Timeline (과거 국면 전환 이력)

---

### 2. **Central Bank Policy Tracker** (중앙은행 정책 추적)
   **목적**: Fed 및 주요 중앙은행의 정책 방향성 분석

   **핵심 요소**:
   - **Fed Policy Stance Gauge**
     - Hawkish ←→ Dovish 스펙트럼
     - 입력: Fed Funds Rate, Dot Plot, FOMC 성명서 sentiment 분석
     - 다음 FOMC 예상 확률 (25bp 인상/인하/동결)

   - **Yield Curve Analysis**
     - 2-10년 스프레드 (경기 침체 신호)
     - 3개월-10년 스프레드
     - 실시간 곡선 형태: Normal / Flat / Inverted
     - 역사적 역전 사례와 비교

   - **Real Rates Monitor**
     - Nominal Yield - Inflation Expectations
     - 실질금리 추세 (자산 가격에 미치는 영향)

   - **Global Central Bank Dashboard**
     - ECB, BOJ, BOE, PBoC 주요 정책금리
     - 통화정책 싱크로나이제이션 (동조화) vs 디버전스
     - 글로벌 유동성 지수 (M2 합산)

   **시각화**:
   - Gauge 차트 (Hawkish-Dovish)
   - 수익률 곡선 인터랙티브 차트
   - 중앙은행 정책금리 비교 차트

---

### 3. **Inflation & Labor Market Deep Dive** (인플레이션 & 노동시장 심층분석)
   **목적**: 인플레이션 압력과 노동시장 건전성 종합 평가

   **핵심 요소**:
   - **Inflation Decomposition**
     - Headline CPI vs Core CPI
     - Categories: Energy, Food, Shelter, Services, Goods
     - Sticky vs Flexible prices
     - 기대 인플레이션 (5yr-5yr forward, U.Mich survey)

   - **Wage Pressure Index**
     - Average Hourly Earnings YoY
     - Unit Labor Cost
     - Productivity-adjusted wage growth
     - Labor Share of Income

   - **Labor Market Heat Map**
     - Unemployment Rate
     - U6 (광의 실업률)
     - Job Openings (JOLTS)
     - Quits Rate (자발적 이직률 - 노동시장 건전성 지표)
     - Labor Force Participation Rate
     - Initial Jobless Claims (주간 데이터)

   - **Phillips Curve Tracker**
     - Unemployment vs Inflation scatter
     - 현재 위치의 역사적 맥락

   **시각화**:
   - Stacked bar chart (인플레이션 구성 요소)
   - Heatmap (노동시장 지표)
   - Scatter plot (Phillips Curve)

---

### 4. **Financial Conditions & Credit** (금융 조건 & 신용)
   **목적**: 금융시장의 "plumbing" 건전성 평가

   **핵심 요소**:
   - **Financial Conditions Index**
     - Goldman Sachs / Bloomberg / Chicago Fed FCI 통합
     - Tighter ←→ Looser 스펙트럼
     - 구성: 금리, 스프레드, 주가, 달러, 변동성

   - **Credit Spreads Dashboard**
     - Investment Grade vs High Yield spread
     - BBB-Treasury spread (IG 하단)
     - Distressed ratio (스프레드 1000bp 이상)
     - Historical percentile

   - **Liquidity Indicators**
     - TED Spread (은행 간 신용위험)
     - LIBOR-OIS Spread
     - Fed Repo Operations
     - Commercial Paper outstanding

   - **Consumer & Corporate Health**
     - Consumer Credit growth
     - Delinquency rates (신용카드, 자동차, 주택담보)
     - Corporate Debt/EBITDA ratio
     - Interest Coverage Ratio

   **시각화**:
   - FCI 시계열 + 경기침체 음영
   - Credit spread 히스토리컬 백분위
   - Delinquency trend lines

---

### 5. **Market Sentiment & Risk Appetite** (시장 심리 & 위험선호도)
   **목적**: 시장 참여자들의 감정과 positioning 파악

   **핵심 요소**:
   - **Fear & Greed Composite**
     - VIX (변동성 지수)
     - SKEW (꼬리 위험 프리미엄)
     - Put/Call Ratio (옵션 시장 sentiment)
     - High Yield Spread
     - Junk Bond Demand
     - Safe Haven Demand (Gold, Treasuries, JPY)
     - 0-100 스코어로 정규화

   - **Positioning Indicators**
     - CFTC Commitments of Traders (주요 자산)
     - AAII Investor Sentiment (Bull/Bear ratio)
     - Fund flows (equity, bond, money market)
     - Margin Debt (레버리지 수준)

   - **Cross-Asset Correlation**
     - Stock-Bond correlation (regime shift 신호)
     - Dollar-Commodity correlation
     - Risk-On vs Risk-Off signal

   **시각화**:
   - Fear & Greed 게이지 (0-100)
   - Sentiment 히스토리컬 분포 + 현재 위치
   - Correlation heatmap

---

### 6. **Sector & Asset Allocation Implications** (섹터 & 자산배분 시사점)
   **목적**: 현재 매크로 환경에서 어떤 섹터/자산이 유리한지 분석

   **핵심 요소**:
   - **Regime-Based Asset Ranking**
     - 현재 Economic Regime에 따른 자산군 성과 기대치
     - 예: Goldilocks → Growth stocks, Tech
     - 예: Stagflation → Commodities, TIPS
     - 예: Deflation → Long-duration bonds, defensive stocks

   - **Sector Rotation Model**
     - Economic cycle stage → 선호 섹터 매핑
     - Early Cycle: Financials, Industrials
     - Mid Cycle: Technology, Consumer Discretionary
     - Late Cycle: Energy, Materials
     - Recession: Utilities, Consumer Staples, Healthcare

   - **Style Factor Preferences**
     - Growth vs Value (실질금리 민감도)
     - Quality (credit spread 환경)
     - Momentum (risk appetite)
     - Low Volatility (VIX 수준)

   - **Smart Beta Signals**
     - Carry Trade attractiveness (금리 차이)
     - Commodity momentum
     - Currency trends

   **시각화**:
   - 자산군 performance heat map
   - 섹터 로테이션 휠
   - Factor exposure 레이더 차트

---

### 7. **Global Macro Context** (글로벌 매크로 맥락)
   **목적**: 미국 외 주요 경제권 모니터링

   **핵심 요소**:
   - **Economic Divergence Tracker**
     - US vs EU vs China vs Japan
     - GDP growth differential
     - Inflation differential
     - Policy rate differential

   - **Trade & Capital Flows**
     - Global Trade Volume (Baltic Dry Index)
     - Emerging Market flows
     - Dollar liquidity (offshore dollar funding)

   - **Currency Majors**
     - DXY (Dollar Index) strength
     - EUR/USD, USD/JPY, USD/CNY
     - Real Effective Exchange Rates

   - **Geopolitical Risk Monitor**
     - Geopolitical Risk Index (GPR by Caldara & Iacoviello)
     - Key events timeline
     - Affected markets/sectors

   **시각화**:
   - 글로벌 경제 성장률 맵
   - 통화 strength 차트
   - Risk event timeline

---

### 8. **Macro Alerts & Signals** (매크로 경고 & 시그널)
   **목적**: 중요한 매크로 변화 자동 감지 및 알림

   **핵심 요소**:
   - **Threshold Alerts**
     - Yield curve inverted (2-10 스프레드 < 0)
     - VIX spike (> 30)
     - High Yield spread widening (> 500bp)
     - Unemployment claims surge (4주 평균 10% 증가)
     - CPI surprise (예상 대비 ±0.3% 초과)

   - **Pattern Recognition**
     - Economic indicator 3개월 연속 하락
     - Fed policy pivot 징후 (FOMC statement 변화)
     - Recession probability model (Sahm Rule, Leading Economic Index)

   - **Calendar & Data Releases**
     - 다음 주요 이벤트 (FOMC, NFP, CPI 발표일)
     - Consensus vs Previous
     - Market impact 예상도

---

## 🛠️ Technical Implementation

### Backend API Extensions

#### New Endpoints
```
GET /api/macro/regime/current
- Returns current economic regime (4 quadrants)
- Growth momentum, Inflation momentum, Regime classification

GET /api/macro/regime/history?period=5y
- Historical regime transitions

GET /api/macro/fed-policy/stance
- Hawkish-Dovish score
- Next meeting probabilities
- Dot plot data

GET /api/macro/yield-curve
- Full curve data (3m, 6m, 1y, 2y, 5y, 10y, 30y)
- Spread calculations
- Inversion signals

GET /api/macro/inflation/decomposition
- CPI components
- Sticky vs Flexible
- Expected inflation metrics

GET /api/macro/labor/dashboard
- Comprehensive labor market metrics
- JOLTS, claims, wages, participation

GET /api/macro/financial-conditions
- FCI from multiple sources
- Credit spreads
- Liquidity indicators

GET /api/macro/sentiment/composite
- Fear & Greed Index (0-100)
- VIX, Put/Call, Spreads, Flows

GET /api/macro/positioning
- CFTC data
- Fund flows
- Margin debt

GET /api/macro/asset-allocation/signals
- Regime-based asset ranking
- Sector rotation recommendations
- Factor preferences

GET /api/macro/global/dashboard
- Major economies comparison
- Currency movements
- Trade flows

GET /api/macro/alerts/active
- Current macro alerts
- Pattern detections

GET /api/macro/calendar/upcoming
- Economic calendar
- Consensus estimates
```

### Data Sources Integration

1. **FRED (Federal Reserve Economic Data)**
   - Core economic indicators ✅ (이미 구현)
   - Add: JOLTS, Yield curve, FCI, Leading indicators

2. **CBOE (VIX, SKEW, Put/Call)**
   - Market sentiment metrics

3. **CFTC (Commitments of Traders)**
   - Positioning data

4. **Bloomberg/Reuters** (if available)
   - Credit spreads
   - Financial conditions indices

5. **Alternative Data**
   - AAII Sentiment
   - Geopolitical Risk Index
   - Economic Surprise Index

### Frontend Components

#### New Components Structure
```
components/macro/
├── RegimeDashboard.jsx          # 4-quadrant chart
├── FedPolicyGauge.jsx           # Hawkish-Dovish gauge
├── YieldCurveChart.jsx          # Interactive yield curve
├── InflationDecomposition.jsx   # Stacked/breakdown charts
├── LaborMarketHeatmap.jsx       # Multi-metric heatmap
├── FinancialConditionsWidget.jsx # FCI gauge + spreads
├── SentimentComposite.jsx       # Fear & Greed gauge
├── AssetAllocationGrid.jsx      # Regime-based recommendations
├── GlobalMacroMap.jsx           # World map with metrics
├── MacroAlertsPanel.jsx         # Active alerts list
├── EconomicCalendar.jsx         # Upcoming events
└── MacroSummaryCard.jsx         # Executive summary
```

#### New Page Layout
```
MacroAnalysisPage.jsx
├── Header (Summary + Current Regime)
├── Tab Navigation
│   ├── Overview (Executive Summary)
│   ├── Economic Regime
│   ├── Central Bank Policy
│   ├── Inflation & Labor
│   ├── Financial Conditions
│   ├── Market Sentiment
│   ├── Asset Allocation
│   ├── Global Macro
│   └── Alerts & Calendar
└── Interactive Charts Section
```

---

## 📈 Sample User Journeys

### Journey 1: Portfolio Manager - Morning Routine
1. Opens Macro tab
2. Sees **Overview**: "Growth slowing, Inflation sticky → Late Cycle"
3. Checks **Fed Policy**: "Hawkish stance maintained, 80% hold probability"
4. Reviews **Asset Allocation**: "Favor defensives, reduce growth exposure"
5. Checks **Alerts**: "Yield curve steepening, credit spreads stable"
6. Adjusts portfolio: Rotates to Utilities, Healthcare

### Journey 2: Risk Manager - Stress Testing
1. Goes to **Financial Conditions** tab
2. Sees FCI tightening → stress scenario
3. Checks **Credit Spreads**: HY spread widening
4. Reviews **Liquidity Indicators**: TED spread elevated
5. Triggers portfolio stress test with new parameters

### Journey 3: Macro Analyst - Research
1. Explores **Economic Regime** history
2. Identifies current phase similar to 2018 Q4
3. Analyzes **Sector Rotation** patterns from that period
4. Publishes report: "Expect rotation to Quality & Defensives"

---

## 🎨 UI/UX Enhancements

### Design Principles
- **Information Density**: Pack more insights, less clutter
- **Color Coding**: Consistent scheme
  - 🟢 Green: Expansionary, Risk-On, Dovish
  - 🔴 Red: Contractionary, Risk-Off, Hawkish
  - 🟡 Yellow: Neutral, Transitioning, Watch
- **Hierarchy**: Executive summary → Details → Raw data
- **Interactivity**: Hover for details, click for drill-down
- **Responsiveness**: Mobile-friendly dashboards

### Key Visual Elements
1. **Regime Quadrant Chart**: Animated dot moving through quadrants
2. **Gauge Charts**: For scalar metrics (Fear & Greed, Fed Stance)
3. **Heatmaps**: For multi-dimensional data (Labor, Sentiment)
4. **Timelines**: For historical context and future events
5. **Comparison Tables**: Side-by-side metrics

---

## 🔬 Advanced Analytics (Phase 2)

### Machine Learning Enhancements
1. **Recession Probability Model**
   - Train on historical data (NBER recession dates)
   - Features: Yield curve, unemployment, LEI, credit spreads
   - Output: 0-100% probability next 12 months

2. **Regime Prediction**
   - Predict regime transition in next quarter
   - Confidence intervals

3. **Sentiment NLP**
   - FOMC statement sentiment analysis
   - Fed speakers' speeches tone analysis
   - News sentiment aggregation

4. **Anomaly Detection**
   - Flag unusual indicator movements
   - Historical context (percentile ranking)

### Backtesting Framework
- Historical regime → Asset performance
- Validate sector rotation model
- Optimize alert thresholds

---

## 📊 Success Metrics

### User Engagement
- Time spent on Macro tab
- Most viewed sub-tabs
- Alert interaction rate

### Decision Impact
- User survey: "Did macro insights inform your decisions?"
- Correlation between regime changes and user trading activity

### Data Quality
- API uptime & latency
- Data freshness (< 1 day lag for daily metrics)
- Coverage (% of planned indicators live)

---

## 🚀 Implementation Roadmap

### Phase 1: Core Framework (Week 1-2)
- [ ] Economic Regime Dashboard
- [ ] Fed Policy Tracker
- [ ] Yield Curve Analysis
- [ ] Basic Alerts System

### Phase 2: Depth & Breadth (Week 3-4)
- [ ] Inflation & Labor Deep Dive
- [ ] Financial Conditions Index
- [ ] Market Sentiment Composite
- [ ] Global Macro Dashboard

### Phase 3: Intelligence Layer (Week 5-6)
- [ ] Asset Allocation Signals
- [ ] Pattern Recognition Alerts
- [ ] Economic Calendar Integration
- [ ] Positioning Data (CFTC)

### Phase 4: Advanced Analytics (Future)
- [ ] ML-based Recession Model
- [ ] Sentiment NLP
- [ ] Backtesting Tools
- [ ] Custom Alerts Builder

---

## 💡 Competitive Differentiation

현재 유사 플랫폼 (Bloomberg, FactSet, Yardeni Research) 대비:

**Our Edge:**
1. **Integrated Actionability**: 단순 데이터 제공이 아닌, "지금 뭘 해야 하는가" 제시
2. **Visual Clarity**: 복잡한 매크로를 직관적 시각화로
3. **Retail-Friendly**: 기관급 분석을 개인 투자자도 이해 가능하게
4. **Real-time Regime**: 경기 국면 실시간 추적 및 히스토리
5. **Open Source DNA**: 투명한 방법론, 커스터마이징 가능

---

## 📚 References & Methodology

### Academic Foundation
- **Business Cycle Theory**: NBER methodology
- **Monetary Policy**: Taylor Rule, Fed reaction function
- **Asset Allocation**: Tactical Asset Allocation frameworks
- **Market Microstructure**: Liquidity, positioning indicators

### Data Providers
- Federal Reserve Economic Data (FRED)
- Bureau of Labor Statistics (BLS)
- CBOE (Volatility Indices)
- CFTC (Positioning Data)

### Inspiration
- Ray Dalio's Economic Principles
- Bridgewater's Daily Observations
- Goldman Sachs Economic Research
- JP Morgan Asset Management Guide to Markets

---

## 🎯 Final Vision

**"The Macro tab should answer 3 questions every morning:"**

1. **Where are we?** (Economic regime, cycle stage)
2. **Where are we going?** (Leading indicators, Fed path)
3. **What should I do?** (Asset allocation, sector rotation)

**From Data → Information → Insight → Action**

---

**Author**: Claude (Macro Analyst Persona)
**Date**: 2026-01-08
**Version**: 2.0 - Institutional Grade Macro Analysis
