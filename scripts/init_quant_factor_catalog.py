"""
Seed built-in factor catalog into quant_factor_catalog.

Each row = one factor definition previously held in
  app/frontend/src/data/strategyFactors.js (STRATEGY_FACTORS)
  app/frontend/src/components/strategy/constants.js (FACTOR_BACKEND_EXPANSIONS)

`backends` is a JSON list of {back, label} pairs mapping a factor id to the
backend compute-function names resolved by _compute_factor.
"""
import json
import sys
from pathlib import Path

project_root = str(Path(__file__).parent.parent)
sys.path.insert(0, project_root)

from index_analyzer.utils.db import get_sqlite_db
from index_analyzer.models.orm import Base
from index_analyzer.models.quant_factor_catalog import QuantFactorCatalog


# ── Backend mapping (factor id → backend compute names) ──────────────────────
BACKEND_EXPANSIONS = {
    # Stock: Technical
    'ema':            [{'back': 'EMA',            'label': 'EMA'}],
    'sma':            [{'back': 'SMA',            'label': 'SMA'}],
    'rsi':            [{'back': 'RSI',            'label': 'RSI'}],
    'macd':           [
        {'back': 'MACD_LINE',   'label': 'MACD Line'},
        {'back': 'MACD_SIGNAL', 'label': 'MACD Signal'},
        {'back': 'MACD_HIST',   'label': 'MACD Hist'},
    ],
    'bb':             [
        {'back': 'BB_UPPER', 'label': 'BB Upper'},
        {'back': 'BB_MID',   'label': 'BB Mid'},
        {'back': 'BB_LOWER', 'label': 'BB Lower'},
    ],
    'vwap_intraday':  [{'back': 'VWAP',           'label': 'VWAP'}],

    # Stock: Fundamentals
    'per':            [{'back': 'FUND_PE',        'label': 'P/E Ratio'}],
    'pbr':            [{'back': 'FUND_PB',        'label': 'P/B Ratio'}],
    'roe':            [{'back': 'FUND_ROE',       'label': 'ROE'}],
    'op_margin':      [{'back': 'FUND_OP_MARGIN', 'label': 'Op. Margin'}],
    'debt_ratio':     [{'back': 'FUND_DE',        'label': 'Debt/Equity'}],

    # Stock: Supply & Demand
    'inst_net_buy':    [{'back': 'SUPPLY_INST_NET',    'label': 'Inst. Net Buy'}],
    'foreign_net_buy': [{'back': 'SUPPLY_FOREIGN_NET', 'label': 'Foreign Net Buy'}],
    'short_interest':  [{'back': 'SUPPLY_SHORT',       'label': 'Short Interest'}],

    # Macro: Rates & Monetary
    'base_rate':   [{'back': 'MACRO_BASE_RATE',   'label': 'Base Rate'}],
    'yield_2y':    [{'back': 'MACRO_YIELD_2Y',    'label': '2Y Yield'}],
    'yield_10y':   [{'back': 'MACRO_YIELD_10Y',   'label': '10Y Yield'}],
    'yield_curve': [{'back': 'MACRO_YIELD_CURVE', 'label': 'Yield Spread'}],

    # Macro: Inflation
    'cpi': [{'back': 'MACRO_CPI', 'label': 'CPI'}],
    'ppi': [{'back': 'MACRO_PPI', 'label': 'PPI'}],

    # Macro: FX & Commodities
    'dxy':  [{'back': 'MACRO_DXY',  'label': 'DXY'}],
    'wti':  [{'back': 'MACRO_WTI',  'label': 'WTI'}],
    'gold': [{'back': 'MACRO_GOLD', 'label': 'Gold'}],

    # Micro
    'order_imbalance':  [{'back': 'MICRO_OBI',         'label': 'Order Imbalance'}],
    'spread':           [{'back': 'MICRO_SPREAD',      'label': 'Bid-Ask Spread'}],
    'large_trade':      [{'back': 'MICRO_LARGE_TRADE', 'label': 'Large Trade'}],
    'trade_intensity':  [{'back': 'MICRO_INTENSITY',   'label': 'Trade Intensity'}],
    'turnover_rate':    [{'back': 'MICRO_TURNOVER',    'label': 'Turnover Rate'}],
    'market_depth':     [{'back': 'MICRO_DEPTH',       'label': 'Market Depth'}],

    # Alt Data
    'news_sentiment':   [{'back': 'NEWS_SENTIMENT',       'label': 'News Sent.'}],
    'sentiment_delta':  [{'back': 'SENTIMENT_DELTA',      'label': 'Sent. Delta'}],
    'google_trends':    [{'back': 'ALT_GOOGLE_TRENDS',    'label': 'Google Trends'}],
    'naver_trends':     [{'back': 'ALT_NAVER_TRENDS',     'label': 'Naver Trends'}],
    'social_mentions':  [{'back': 'ALT_SOCIAL_MENTIONS',  'label': 'Social Mentions'}],
    'influence_index':  [{'back': 'ALT_INFLUENCE_INDEX',  'label': 'Influence Index'}],

    # Options
    'opt_bs': [
        {'back': 'OPT_BS_PRICE', 'label': 'BS Call Price'},
        {'back': 'OPT_BS_DELTA', 'label': 'BS Delta'},
        {'back': 'OPT_BS_GAMMA', 'label': 'BS Gamma'},
        {'back': 'OPT_BS_THETA', 'label': 'BS Theta/Day'},
        {'back': 'OPT_BS_VEGA',  'label': 'BS Vega/1%'},
    ],
    'opt_heston': [
        {'back': 'OPT_HESTON_PRICE', 'label': 'Heston Price'},
        {'back': 'OPT_HESTON_DELTA', 'label': 'Heston Delta'},
    ],

    # Chart
    'volume_profile': [
        {'back': 'CHART_VP_POC', 'label': 'POC'},
        {'back': 'CHART_VP_VAH', 'label': 'VAH'},
        {'back': 'CHART_VP_VAL', 'label': 'VAL'},
    ],
    'liquidity_sweep': [
        {'back': 'CHART_LIQ_SWEEP_HIGH', 'label': 'Sweep High'},
        {'back': 'CHART_LIQ_SWEEP_LOW',  'label': 'Sweep Low'},
    ],
    'hmm_regime': [
        {'back': 'CHART_HMM_STATE',     'label': 'Regime State'},
        {'back': 'CHART_HMM_BULL_PROB', 'label': 'Bull Prob'},
    ],
}


# ── Factor catalog (ordered — sort_order assigned by position) ───────────────
FACTOR_SEEDS = [
    # Macro: Rates & Monetary
    {'key': 'base_rate',   'name': 'Base Rate',            'name_ko': '기준금리',
     'category': 'Macro',  'sub': '금리 및 통화',
     'desc': '중앙은행 기준금리 수준',
     'examples': 'Fed Funds Rate, BOK 기준금리',
     'strategic': '시장 유동성 및 경기 사이클 판단',
     'params': [], 'availability': 'available'},
    {'key': 'yield_2y',    'name': '2Y Treasury Yield',    'name_ko': '2년물 국채 수익률',
     'category': 'Macro',  'sub': '금리 및 통화',
     'desc': '단기 국채 수익률, 통화정책 기대치 반영',
     'examples': 'US 2Y Treasury, KTB 2Y',
     'strategic': '단기 금리 환경 및 통화정책 방향성 판단',
     'params': [], 'availability': 'available'},
    {'key': 'yield_10y',   'name': '10Y Treasury Yield',   'name_ko': '10년물 국채 수익률',
     'category': 'Macro',  'sub': '금리 및 통화',
     'desc': '장기 국채 수익률, 장기 성장 기대치 반영',
     'examples': 'US 10Y Treasury, KTB 10Y',
     'strategic': '장기 금리 환경 및 경기 전망 판단',
     'params': [], 'availability': 'available'},
    {'key': 'yield_curve', 'name': 'Yield Curve Spread',   'name_ko': '장단기 금리차',
     'category': 'Macro',  'sub': '금리 및 통화',
     'desc': '10Y − 2Y 국채 수익률 스프레드, 경기 선행지표',
     'examples': '10Y-2Y Spread, Inverted Yield Curve',
     'strategic': '경기 침체 신호 및 사이클 국면 판단',
     'params': [], 'availability': 'available'},

    # Macro: Inflation
    {'key': 'cpi', 'name': 'CPI', 'name_ko': '소비자물가지수',
     'category': 'Macro', 'sub': '인플레이션',
     'desc': '소비자 물가 변동률 (YoY/MoM)',
     'examples': 'US CPI YoY, Core CPI, 한국 소비자물가',
     'strategic': '자산 배분 및 인플레이션 헤지 전략',
     'params': [], 'availability': 'available'},
    {'key': 'ppi', 'name': 'PPI', 'name_ko': '생산자물가지수',
     'category': 'Macro', 'sub': '인플레이션',
     'desc': '생산자 단계 물가 변동률, CPI 선행지표',
     'examples': 'US PPI YoY, 한국 PPI',
     'strategic': '원가 압력 분석 및 마진 방향성 예측',
     'params': [], 'availability': 'available'},

    # Macro: FX & Commodities
    {'key': 'dxy',  'name': 'Dollar Index (DXY)', 'name_ko': '달러 인덱스',
     'category': 'Macro', 'sub': '환율 및 원자재',
     'desc': '주요 6개국 통화 대비 달러 강세 지수',
     'examples': 'DXY, USDKRW, USDJPY',
     'strategic': '환차익 모델 및 업종별 환율 민감도 분석',
     'params': [], 'availability': 'available'},
    {'key': 'wti',  'name': 'WTI Crude Oil', 'name_ko': '서부 텍사스 원유',
     'category': 'Macro', 'sub': '환율 및 원자재',
     'desc': '서부 텍사스산 원유 현물가격',
     'examples': 'WTI Spot, Brent Crude, NG',
     'strategic': '에너지 섹터 및 물가 영향 분석',
     'params': [], 'availability': 'available'},
    {'key': 'gold', 'name': 'Gold Price', 'name_ko': '금 가격',
     'category': 'Macro', 'sub': '환율 및 원자재',
     'desc': '금 현물 및 선물 가격',
     'examples': 'XAUUSD, Gold Futures (GC)',
     'strategic': '안전자산 수요 및 인플레이션 헤지 판단',
     'params': [], 'availability': 'available'},

    # Micro: Order Book
    {'key': 'order_imbalance', 'name': 'Order Imbalance', 'name_ko': '호가 불균형',
     'category': 'Micro', 'sub': '호가창 데이터',
     'desc': '매수/매도 잔량 비율 불균형 (OBI)',
     'examples': 'Bid-Ask Imbalance, Order Book Imbalance',
     'strategic': '초단타(HFT) 및 마켓 메이킹 신호',
     'params': [{'name': 'levels', 'label': 'Depth Levels', 'default': 5, 'min': 1, 'max': 20, 'step': 1}],
     'availability': 'beta'},
    {'key': 'spread', 'name': 'Bid-Ask Spread', 'name_ko': '매수-매도 스프레드',
     'category': 'Micro', 'sub': '호가창 데이터',
     'desc': '최우선 매수/매도 호가 차이 (스프레드)',
     'examples': 'Quoted Spread, Effective Spread',
     'strategic': '거래비용 추정 및 유동성 품질 평가',
     'params': [], 'availability': 'beta'},

    # Micro: Execution Data
    {'key': 'large_trade', 'name': 'Large Trade Volume', 'name_ko': '대량 체결',
     'category': 'Micro', 'sub': '체결 데이터',
     'desc': '기준 수량 이상의 대량 체결 건수 및 방향',
     'examples': 'Block Trade, Whale Order Detection',
     'strategic': '수급 분석 및 진입/청산 시점 결정',
     'params': [
         {'name': 'threshold', 'label': 'Min Volume',   'default': 10000, 'min': 100, 'step': 1000},
         {'name': 'period',    'label': 'Period (min)', 'default': 10,    'min': 1, 'max': 60, 'step': 1},
     ],
     'availability': 'beta'},
    {'key': 'trade_intensity', 'name': 'Trade Intensity', 'name_ko': '체결 강도',
     'category': 'Micro', 'sub': '체결 데이터',
     'desc': '매수체결 / 전체체결 비율 (매수 압력 지표)',
     'examples': 'Buy Power Index, Aggressiveness Ratio',
     'strategic': '수급 방향성 및 시장 압력 판단',
     'params': [{'name': 'period', 'label': 'Period (min)', 'default': 30, 'min': 1, 'max': 240, 'step': 5}],
     'availability': 'beta'},
    {'key': 'vwap_intraday', 'name': 'Intraday VWAP', 'name_ko': '장중 VWAP',
     'category': 'Micro', 'sub': '체결 데이터',
     'desc': '장중 거래량 가중 평균가격 (VWAP)',
     'examples': 'VWAP, TWAP, Anchored VWAP',
     'strategic': '진입/청산 벤치마크 및 가격 공정성 평가',
     'params': [], 'availability': 'beta'},

    # Micro: Liquidity
    {'key': 'turnover_rate', 'name': 'Turnover Rate', 'name_ko': '회전율',
     'category': 'Micro', 'sub': '유동성',
     'desc': '거래량 / 유동주식수 회전율',
     'examples': 'Daily Turnover %, Weekly Turnover',
     'strategic': '슬리피지 방지 및 포지션 비중 조절',
     'params': [{'name': 'period', 'label': 'Period (days)', 'default': 5, 'min': 1, 'max': 60, 'step': 1}],
     'availability': 'available'},
    {'key': 'market_depth', 'name': 'Market Depth', 'name_ko': '호가 깊이',
     'category': 'Micro', 'sub': '유동성',
     'desc': 'N단계 호가 잔량 합계 (시장충격 추정)',
     'examples': 'LOB Depth, Queue Depth, Level-2 Data',
     'strategic': '대량 주문 시 시장충격 추정 및 비중 조절',
     'params': [{'name': 'levels', 'label': 'Depth Levels', 'default': 5, 'min': 1, 'max': 20, 'step': 1}],
     'availability': 'beta'},

    # Stock: Fundamentals
    {'key': 'per', 'name': 'P/E Ratio', 'name_ko': '주가수익비율 (PER)',
     'category': 'Stock', 'sub': '펀더멘털',
     'desc': '주가 / 주당순이익 (밸류에이션 지표)',
     'examples': 'Trailing P/E, Forward P/E',
     'strategic': '가치 투자 및 밸류에이션 스크리닝',
     'params': [], 'availability': 'available'},
    {'key': 'pbr', 'name': 'P/B Ratio', 'name_ko': '주가순자산비율 (PBR)',
     'category': 'Stock', 'sub': '펀더멘털',
     'desc': '주가 / 주당순자산 (자산 대비 밸류에이션)',
     'examples': 'PBR, Price-to-Book',
     'strategic': '저평가 종목 스크리닝 및 자산가치 투자',
     'params': [], 'availability': 'available'},
    {'key': 'roe', 'name': 'ROE', 'name_ko': '자기자본이익률',
     'category': 'Stock', 'sub': '펀더멘털',
     'desc': '당기순이익 / 자기자본 (수익성 지표)',
     'examples': 'ROE TTM, ROE YoY Change',
     'strategic': '퀄리티 팩터 모델 및 우량주 선별',
     'params': [], 'availability': 'available'},
    {'key': 'op_margin', 'name': 'Operating Margin', 'name_ko': '영업이익률',
     'category': 'Stock', 'sub': '펀더멘털',
     'desc': '영업이익 / 매출액 (본업 수익성)',
     'examples': 'Operating Margin %, EBITDA Margin',
     'strategic': '수익성 팩터 스크리닝 및 경쟁우위 분석',
     'params': [], 'availability': 'available'},
    {'key': 'debt_ratio', 'name': 'Debt-to-Equity', 'name_ko': '부채비율',
     'category': 'Stock', 'sub': '펀더멘털',
     'desc': '총부채 / 자기자본 (재무 레버리지)',
     'examples': 'D/E Ratio, Net Debt/EBITDA',
     'strategic': '재무 리스크 필터링 및 안전 마진 설정',
     'params': [], 'availability': 'available'},

    # Stock: Price & Volume
    {'key': 'ema', 'name': 'EMA', 'name_ko': '지수이동평균',
     'category': 'Stock', 'sub': '가격/거래량',
     'desc': '지수 가중 이동평균 — 최근 가격에 더 높은 비중',
     'examples': 'EMA(9), EMA(20), EMA(50)',
     'strategic': '모멘텀 추세 추종 및 골든/데드크로스',
     'params': [{'name': 'period', 'label': 'Period', 'default': 20, 'min': 2, 'max': 500, 'step': 1}],
     'availability': 'available'},
    {'key': 'sma', 'name': 'SMA', 'name_ko': '단순이동평균',
     'category': 'Stock', 'sub': '가격/거래량',
     'desc': '단순 이동평균 — n일 종가 산술평균',
     'examples': 'SMA(20), SMA(50), SMA(200)',
     'strategic': '추세 방향 확인 및 지지/저항 레벨',
     'params': [{'name': 'period', 'label': 'Period', 'default': 50, 'min': 2, 'max': 500, 'step': 1}],
     'availability': 'available'},
    {'key': 'rsi', 'name': 'RSI', 'name_ko': '상대강도지수',
     'category': 'Stock', 'sub': '가격/거래량',
     'desc': '상대강도지수 (0~100) — 과매수/과매도 측정',
     'examples': 'RSI(14), RSI(9)',
     'strategic': '과매수/과매도 및 평균 회귀(Mean Reversion)',
     'params': [{'name': 'period', 'label': 'Period', 'default': 14, 'min': 2, 'max': 100, 'step': 1}],
     'availability': 'available'},
    {'key': 'macd', 'name': 'MACD', 'name_ko': 'MACD',
     'category': 'Stock', 'sub': '가격/거래량',
     'desc': '이동평균 수렴/발산 — 단기·장기 EMA 차이',
     'examples': 'MACD(12,26,9)',
     'strategic': '모멘텀 변화 포착 및 추세 전환 신호',
     'params': [
         {'name': 'fast',   'label': 'Fast',   'default': 12, 'min': 2, 'max': 100, 'step': 1},
         {'name': 'slow',   'label': 'Slow',   'default': 26, 'min': 2, 'max': 200, 'step': 1},
         {'name': 'signal', 'label': 'Signal', 'default': 9,  'min': 2, 'max': 50,  'step': 1},
     ],
     'availability': 'available'},
    {'key': 'bb', 'name': 'Bollinger Bands', 'name_ko': '볼린저 밴드',
     'category': 'Stock', 'sub': '가격/거래량',
     'desc': '평균 ± k×표준편차 — 변동성 채널',
     'examples': 'BB(20, 2.0) — Upper/Mid/Lower',
     'strategic': '변동성 돌파 전략 및 평균 회귀',
     'params': [
         {'name': 'period',  'label': 'Period',  'default': 20,  'min': 5,   'max': 200, 'step': 1},
         {'name': 'std_dev', 'label': 'Std Dev', 'default': 2.0, 'min': 0.5, 'max': 5,   'step': 0.1},
     ],
     'availability': 'available'},

    # Stock: Supply & Demand
    {'key': 'inst_net_buy', 'name': 'Institutional Net Buy', 'name_ko': '기관 순매수',
     'category': 'Stock', 'sub': '수급 주체',
     'desc': '기관투자자 순매수량 (N일 누적)',
     'examples': '기관 순매수/순매도량 (주, 원)',
     'strategic': '추세 추종 및 기관 수급 방향성 포착',
     'params': [{'name': 'period', 'label': 'Period (days)', 'default': 5, 'min': 1, 'max': 60, 'step': 1}],
     'availability': 'available'},
    {'key': 'foreign_net_buy', 'name': 'Foreign Net Buy', 'name_ko': '외국인 순매수',
     'category': 'Stock', 'sub': '수급 주체',
     'desc': '외국인 순매수량 (N일 누적)',
     'examples': '외국인 순매수/순매도량 (주, 원)',
     'strategic': '외인 수급 흐름 분석 및 반전 신호',
     'params': [{'name': 'period', 'label': 'Period (days)', 'default': 5, 'min': 1, 'max': 60, 'step': 1}],
     'availability': 'available'},
    {'key': 'short_interest', 'name': 'Short Interest', 'name_ko': '공매도 잔고',
     'category': 'Stock', 'sub': '수급 주체',
     'desc': '공매도 잔고 및 잔고 비율',
     'examples': 'Short Interest Ratio, Days to Cover',
     'strategic': '반전 신호 포착 및 숏 스퀴즈 탐지',
     'params': [], 'availability': 'available'},

    # Options
    {'key': 'opt_bs', 'name': 'Black-Scholes (FFT)', 'name_ko': 'BS 옵션 (FFT)',
     'category': 'Options', 'sub': '옵션 프라이싱',
     'desc': 'Carr-Madan FFT 기반 Black-Scholes 콜옵션 가격 및 그릭스. 고정 Moneyness 롤링 옵션.',
     'examples': 'Call Price, Delta, Gamma, Theta, Vega',
     'strategic': '옵션 그릭스 기반 방향성 신호 및 변동성 전략',
     'params': [
         {'name': 'r',         'label': 'Rate %',      'default': 5.0,  'min': 0,    'max': 20,  'step': 0.1},
         {'name': 'T',         'label': 'Expiry (yr)', 'default': 0.25, 'min': 0.01, 'max': 5,   'step': 0.01},
         {'name': 'sigma',     'label': 'Vol %',       'default': 25.0, 'min': 1,    'max': 200, 'step': 0.5},
         {'name': 'moneyness', 'label': 'Moneyness %', 'default': 0.0,  'min': -50,  'max': 50,  'step': 1},
     ],
     'availability': 'available'},
    {'key': 'opt_heston', 'name': 'Heston Model (FFT)', 'name_ko': '헤스톤 모델 (FFT)',
     'category': 'Options', 'sub': '옵션 프라이싱',
     'desc': '확률적 변동성 Heston 모델 FFT 옵션 가격. 분산 평균회귀(kappa·theta)·변동성의변동성(xi)·상관관계(rho) 파라미터.',
     'examples': 'Heston Call Price, Heston Delta',
     'strategic': '스토캐스틱 변동성 환경의 고급 옵션 신호 전략',
     'params': [
         {'name': 'r',         'label': 'Rate %',      'default': 5.0,  'min': 0,     'max': 20,   'step': 0.1},
         {'name': 'T',         'label': 'Expiry (yr)', 'default': 0.25, 'min': 0.01,  'max': 5,    'step': 0.01},
         {'name': 'moneyness', 'label': 'Moneyness %', 'default': 0.0,  'min': -50,   'max': 50,   'step': 1},
         {'name': 'v0',        'label': 'v₀ (%²)',     'default': 4.0,  'min': 0.01,  'max': 100,  'step': 0.1},
         {'name': 'kappa',     'label': 'Kappa',       'default': 2.0,  'min': 0.01,  'max': 20,   'step': 0.1},
         {'name': 'theta',     'label': 'Theta (%²)',  'default': 4.0,  'min': 0.01,  'max': 100,  'step': 0.1},
         {'name': 'xi',        'label': 'Xi (VolVol)', 'default': 0.5,  'min': 0.01,  'max': 5,    'step': 0.05},
         {'name': 'rho',       'label': 'Rho',         'default': -0.7, 'min': -0.99, 'max': 0.99, 'step': 0.05},
     ],
     'availability': 'available'},

    # Alt Data: Sentiment
    {'key': 'news_sentiment', 'name': 'News Sentiment', 'name_ko': '뉴스 감성 점수',
     'category': 'Alt', 'sub': '감성 분석',
     'desc': '뉴스 헤드라인 AI 감성 점수 (-1 부정 ~ +1 긍정)',
     'examples': 'Positive/Negative/Neutral Score, 감성 모멘텀',
     'strategic': '단기 이벤트 드리븐(Event-Driven) 전략',
     'params': [{'name': 'lookback', 'label': 'Lookback (days)', 'default': 5, 'min': 1, 'max': 30, 'step': 1}],
     'availability': 'external'},
    {'key': 'sentiment_delta', 'name': 'Sentiment Momentum', 'name_ko': '감성 모멘텀',
     'category': 'Alt', 'sub': '감성 분석',
     'desc': '단기 vs 장기 감성 점수 차이 (방향 전환 감지)',
     'examples': 'Sentiment Delta = Fast(3d) − Slow(10d)',
     'strategic': '감성 추세 전환점 및 이벤트 선행 포착',
     'params': [
         {'name': 'fast', 'label': 'Fast Window', 'default': 3,  'min': 1, 'max': 14, 'step': 1},
         {'name': 'slow', 'label': 'Slow Window', 'default': 10, 'min': 3, 'max': 30, 'step': 1},
     ],
     'availability': 'external'},

    # Alt Data: Search Trends
    {'key': 'google_trends', 'name': 'Google Trends', 'name_ko': '구글 트렌드',
     'category': 'Alt', 'sub': '검색어 트렌드',
     'desc': '구글 검색량 지수 (0~100)',
     'examples': 'Google Trends Score, Rising Queries',
     'strategic': '대중 관심도 및 과열 상태 측정',
     'params': [{'name': 'lookback', 'label': 'Lookback (days)', 'default': 7, 'min': 1, 'max': 30, 'step': 1}],
     'availability': 'external'},
    {'key': 'naver_trends', 'name': 'Naver DataLab', 'name_ko': '네이버 데이터랩',
     'category': 'Alt', 'sub': '검색어 트렌드',
     'desc': '네이버 검색량 지수 (국내 개인투자자 관심도)',
     'examples': '네이버 데이터랩 검색량 지수',
     'strategic': '국내 개인투자자 관심도 및 투기 과열 측정',
     'params': [{'name': 'lookback', 'label': 'Lookback (days)', 'default': 7, 'min': 1, 'max': 30, 'step': 1}],
     'availability': 'external'},

    # Alt Data: Social Media
    {'key': 'social_mentions', 'name': 'Social Media Mentions', 'name_ko': '소셜 언급량',
     'category': 'Alt', 'sub': '소셜 미디어',
     'desc': '트위터/커뮤니티 종목 언급 횟수',
     'examples': 'Tweet Count, Reddit Mentions, 종목 게시글 수',
     'strategic': '밈 주식(Meme Stock) 및 투심 변화 포착',
     'params': [{'name': 'lookback', 'label': 'Lookback (days)', 'default': 3, 'min': 1, 'max': 14, 'step': 1}],
     'availability': 'external'},
    {'key': 'influence_index', 'name': 'Influence Index', 'name_ko': '영향력 지수',
     'category': 'Alt', 'sub': '소셜 미디어',
     'desc': '팔로워 수 가중 언급량 — 핵심 인플루언서 기반',
     'examples': 'Weighted Mention Score, KOL Index',
     'strategic': '인플루언서 기반 투심 변화 및 급등 선행 탐지',
     'params': [{'name': 'lookback', 'label': 'Lookback (days)', 'default': 3, 'min': 1, 'max': 14, 'step': 1}],
     'availability': 'external'},

    # Chart: Market Structure
    {'key': 'volume_profile', 'name': 'Volume Profile', 'name_ko': '볼륨 프로파일',
     'category': 'Chart', 'sub': '시장 구조',
     'desc': '롤링 구간 가격별 거래량 분포. POC(최다거래가) / VAH·VAL(가치영역 상·하단)',
     'examples': 'POC, Value Area High, Value Area Low',
     'strategic': '수급 집중 가격대 기반 지지·저항 및 돌파 전략',
     'params': [
         {'name': 'lookback', 'label': 'Lookback (days)', 'default': 30, 'min': 5,  'max': 120, 'step': 5},
         {'name': 'bins',     'label': 'Price Bins',      'default': 20, 'min': 10, 'max': 60,  'step': 5},
     ],
     'availability': 'available'},
    {'key': 'liquidity_sweep', 'name': 'Liquidity Sweep', 'name_ko': '유동성 스윕',
     'category': 'Chart', 'sub': '시장 구조',
     'desc': '직전 N봉 고/저점 돌파 후 되돌림 이벤트 (0/1). 스탑 사냥 탐지',
     'examples': 'Sweep High (1=발생), Sweep Low (1=발생)',
     'strategic': '유동성 사냥 이후 반전 매매, 스탑 클러스터 회피',
     'params': [{'name': 'lookback', 'label': 'Lookback (bars)', 'default': 20, 'min': 5, 'max': 60, 'step': 5}],
     'availability': 'available'},
    {'key': 'hmm_regime', 'name': 'HMM Regime', 'name_ko': '은닉 마르코프 국면',
     'category': 'Chart', 'sub': '시장 구조',
     'desc': '수익률·변동성 기반 숨겨진 시장 국면 (0=약세, n_states-1=강세). 롤링 재학습',
     'examples': 'Regime State, Bull Probability',
     'strategic': '국면 필터 — 강세 국면 진입, 약세 국면 청산',
     'params': [
         {'name': 'n_states',     'label': 'States',       'default': 3,   'min': 2,  'max': 4,   'step': 1},
         {'name': 'train_window', 'label': 'Train Window', 'default': 252, 'min': 60, 'max': 750, 'step': 10},
         {'name': 'refit_every',  'label': 'Refit Every',  'default': 20,  'min': 1,  'max': 60,  'step': 1},
     ],
     'availability': 'beta'},
]


def init_quant_factor_catalog():
    db_path = Path(__file__).parent.parent / "data" / "marketpulse.db"
    db_instance = get_sqlite_db(str(db_path))
    Base.metadata.create_all(bind=db_instance.engine)
    session = db_instance.get_session()

    try:
        existing = {row.key: row for row in session.query(QuantFactorCatalog).all()}
        created, updated = 0, 0
        for idx, seed in enumerate(FACTOR_SEEDS):
            key = seed['key']
            payload = dict(
                name         = seed['name'],
                name_ko      = seed.get('name_ko', ''),
                category     = seed['category'],
                sub          = seed.get('sub', ''),
                desc         = seed.get('desc', ''),
                examples     = seed.get('examples', ''),
                strategic    = seed.get('strategic', ''),
                params       = json.dumps(seed.get('params', []), ensure_ascii=False),
                availability = seed.get('availability', 'available'),
                backends     = json.dumps(BACKEND_EXPANSIONS.get(key, []), ensure_ascii=False),
                sort_order   = idx,
                use_yn       = 'Y',
            )
            row = existing.get(key)
            if row:
                for k, v in payload.items():
                    setattr(row, k, v)
                updated += 1
            else:
                session.add(QuantFactorCatalog(key=key, **payload))
                created += 1
        session.commit()
        print(f"[OK] Factor catalog seeded - created={created}, updated={updated}")
    except Exception as e:
        session.rollback()
        print(f"[FAIL] Factor catalog seed failed: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    init_quant_factor_catalog()
