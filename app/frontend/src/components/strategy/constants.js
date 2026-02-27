// ── Tab definitions ───────────────────────────────────────────────────────────

export const TABS = [
  { id: 'all',     label: 'All Factors' },
  { id: 'macro',   label: 'Macro' },
  { id: 'micro',   label: 'Micro' },
  { id: 'stock',   label: 'Stock' },
  { id: 'alt',     label: 'Alt Data' },
  { id: 'options', label: 'Options' },
];

export const TAB_CATEGORY_MAP = {
  macro:   'Macro',
  micro:   'Micro',
  stock:   'Stock',
  alt:     'Alt',
  options: 'Options',
};

// ── Condition builder constants ───────────────────────────────────────────────

/**
 * Maps strategyFactors.js IDs → backend _compute_factor names.
 * Every factor that appears in strategyFactors.js MUST have an entry here
 * or it will be silently skipped by buildVarOptions().
 */
export const FACTOR_BACKEND_EXPANSIONS = {
  // ── Stock: Technical ────────────────────────────────────────────────────────
  ema:            [{ back: 'EMA',            label: 'EMA'          }],
  sma:            [{ back: 'SMA',            label: 'SMA'          }],
  rsi:            [{ back: 'RSI',            label: 'RSI'          }],
  macd:           [
    { back: 'MACD_LINE',   label: 'MACD Line'   },
    { back: 'MACD_SIGNAL', label: 'MACD Signal' },
    { back: 'MACD_HIST',   label: 'MACD Hist'   },
  ],
  bb:             [
    { back: 'BB_UPPER', label: 'BB Upper' },
    { back: 'BB_MID',   label: 'BB Mid'   },
    { back: 'BB_LOWER', label: 'BB Lower' },
  ],
  vwap_intraday:  [{ back: 'VWAP',              label: 'VWAP'            }],

  // ── Stock: Fundamentals ─────────────────────────────────────────────────────
  per:            [{ back: 'FUND_PE',            label: 'P/E Ratio'       }],
  pbr:            [{ back: 'FUND_PB',            label: 'P/B Ratio'       }],
  roe:            [{ back: 'FUND_ROE',           label: 'ROE'             }],
  op_margin:      [{ back: 'FUND_OP_MARGIN',     label: 'Op. Margin'      }],
  debt_ratio:     [{ back: 'FUND_DE',            label: 'Debt/Equity'     }],

  // ── Stock: Supply & Demand ──────────────────────────────────────────────────
  inst_net_buy:   [{ back: 'SUPPLY_INST_NET',    label: 'Inst. Net Buy'   }],
  foreign_net_buy:[{ back: 'SUPPLY_FOREIGN_NET', label: 'Foreign Net Buy' }],
  short_interest: [{ back: 'SUPPLY_SHORT',       label: 'Short Interest'  }],

  // ── Macro: Rates & Monetary ─────────────────────────────────────────────────
  base_rate:      [{ back: 'MACRO_BASE_RATE',    label: 'Base Rate'       }],
  yield_2y:       [{ back: 'MACRO_YIELD_2Y',     label: '2Y Yield'        }],
  yield_10y:      [{ back: 'MACRO_YIELD_10Y',    label: '10Y Yield'       }],
  yield_curve:    [{ back: 'MACRO_YIELD_CURVE',  label: 'Yield Spread'    }],

  // ── Macro: Inflation ────────────────────────────────────────────────────────
  cpi:            [{ back: 'MACRO_CPI',          label: 'CPI'             }],
  ppi:            [{ back: 'MACRO_PPI',          label: 'PPI'             }],

  // ── Macro: FX & Commodities ─────────────────────────────────────────────────
  dxy:            [{ back: 'MACRO_DXY',          label: 'DXY'             }],
  wti:            [{ back: 'MACRO_WTI',          label: 'WTI'             }],
  gold:           [{ back: 'MACRO_GOLD',         label: 'Gold'            }],

  // ── Micro ───────────────────────────────────────────────────────────────────
  order_imbalance:[{ back: 'MICRO_OBI',          label: 'Order Imbalance' }],
  spread:         [{ back: 'MICRO_SPREAD',       label: 'Bid-Ask Spread'  }],
  large_trade:    [{ back: 'MICRO_LARGE_TRADE',  label: 'Large Trade'     }],
  trade_intensity:[{ back: 'MICRO_INTENSITY',    label: 'Trade Intensity' }],
  turnover_rate:  [{ back: 'MICRO_TURNOVER',     label: 'Turnover Rate'   }],
  market_depth:   [{ back: 'MICRO_DEPTH',        label: 'Market Depth'    }],

  // ── Alt Data ────────────────────────────────────────────────────────────────
  news_sentiment: [{ back: 'NEWS_SENTIMENT',     label: 'News Sent.'      }],
  sentiment_delta:[{ back: 'SENTIMENT_DELTA',    label: 'Sent. Delta'     }],
  google_trends:  [{ back: 'ALT_GOOGLE_TRENDS',  label: 'Google Trends'   }],
  naver_trends:   [{ back: 'ALT_NAVER_TRENDS',   label: 'Naver Trends'    }],
  social_mentions:[{ back: 'ALT_SOCIAL_MENTIONS',label: 'Social Mentions' }],
  influence_index:[{ back: 'ALT_INFLUENCE_INDEX',label: 'Influence Index' }],

  // ── Options: Carr-Madan FFT ─────────────────────────────────────────────────
  opt_bs: [
    { back: 'OPT_BS_PRICE', label: 'BS Call Price' },
    { back: 'OPT_BS_DELTA', label: 'BS Delta'      },
    { back: 'OPT_BS_GAMMA', label: 'BS Gamma'      },
    { back: 'OPT_BS_THETA', label: 'BS Theta/Day'  },
    { back: 'OPT_BS_VEGA',  label: 'BS Vega/1%'   },
  ],
  opt_heston: [
    { back: 'OPT_HESTON_PRICE', label: 'Heston Price' },
    { back: 'OPT_HESTON_DELTA', label: 'Heston Delta' },
  ],
};

export const PRICE_VAR_OPTIONS = [
  { key: 'p:CLOSE',  label: 'Close',  factorDef: { factor: 'CLOSE',  params: {} } },
  { key: 'p:HIGH',   label: 'High',   factorDef: { factor: 'HIGH',   params: {} } },
  { key: 'p:LOW',    label: 'Low',    factorDef: { factor: 'LOW',    params: {} } },
  { key: 'p:OPEN',   label: 'Open',   factorDef: { factor: 'OPEN',   params: {} } },
  { key: 'p:VOLUME', label: 'Volume', factorDef: { factor: 'VOLUME', params: {} } },
];

export const COND_OPERATORS = [
  { id: 'crosses_above', label: 'crosses above' },
  { id: 'crosses_below', label: 'crosses below' },
  { id: '>',             label: '>'             },
  { id: '<',             label: '<'             },
  { id: '>=',            label: '>='            },
  { id: '<=',            label: '<='            },
  { id: '==',            label: '=='            },
];
