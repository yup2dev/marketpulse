"""
Seed built-in strategy types into quant_strategy_types.

Each row carries:
  - params:   scan parameter metadata (min/max/step/default) shown in 3D scanner
  - template: factor/condition wiring consumed by _run_custom via the placeholder
              substitution (_substitute_template). Fields referencing a scan
              parameter are written as "##paramKey##" strings; at run time the
              strategy's current parameter values replace them.
"""
import json
import sys
from pathlib import Path

project_root = str(Path(__file__).parent.parent)
sys.path.insert(0, project_root)

from index_analyzer.utils.db import get_sqlite_db
from index_analyzer.models.orm import Base
from index_analyzer.models.quant_strategy_type import QuantStrategyType


def _ema_cross():
    return {
        "factors": [
            {"factorId": "ema", "varName": "ema_fast", "params": {"period": "##fast##"}},
            {"factorId": "ema", "varName": "ema_slow", "params": {"period": "##slow##"}},
        ],
        "buy_conditions": [
            {"left":  {"factor": "EMA", "params": {"period": "##fast##"}},
             "op":    "crosses_above",
             "right": {"factor": "EMA", "params": {"period": "##slow##"}}},
        ],
        "sell_conditions": [
            {"left":  {"factor": "EMA", "params": {"period": "##fast##"}},
             "op":    "crosses_below",
             "right": {"factor": "EMA", "params": {"period": "##slow##"}}},
        ],
        "buy_logic":  "AND",
        "sell_logic": "AND",
    }


def _rsi():
    return {
        "factors": [
            {"factorId": "rsi", "varName": "rsi", "params": {"period": "##rsi_period##"}},
        ],
        "buy_conditions": [
            {"left":  {"factor": "RSI",   "params": {"period": "##rsi_period##"}},
             "op":    "crosses_above",
             "right": {"factor": "VALUE", "value": "##oversold##"}},
        ],
        "sell_conditions": [
            {"left":  {"factor": "RSI",   "params": {"period": "##rsi_period##"}},
             "op":    "crosses_below",
             "right": {"factor": "VALUE", "value": "##overbought##"}},
        ],
        "buy_logic":  "AND",
        "sell_logic": "AND",
    }


def _macd_cross():
    macd_params = {"fast": "##fast##", "slow": "##slow##", "signal": "##signal##"}
    return {
        "factors": [
            {"factorId": "macd", "varName": "macd", "params": dict(macd_params)},
        ],
        "buy_conditions": [
            {"left":  {"factor": "MACD_LINE",   "params": dict(macd_params)},
             "op":    "crosses_above",
             "right": {"factor": "MACD_SIGNAL", "params": dict(macd_params)}},
        ],
        "sell_conditions": [
            {"left":  {"factor": "MACD_LINE",   "params": dict(macd_params)},
             "op":    "crosses_below",
             "right": {"factor": "MACD_SIGNAL", "params": dict(macd_params)}},
        ],
        "buy_logic":  "AND",
        "sell_logic": "AND",
    }


def _bb_breakout():
    bb_params = {"period": "##period##", "std_dev": "##std_dev##"}
    return {
        "factors": [
            {"factorId": "bb", "varName": "bb", "params": dict(bb_params)},
        ],
        "buy_conditions": [
            {"left":  {"factor": "CLOSE",    "params": {}},
             "op":    "crosses_above",
             "right": {"factor": "BB_LOWER", "params": dict(bb_params)}},
        ],
        "sell_conditions": [
            {"left":  {"factor": "CLOSE",    "params": {}},
             "op":    "crosses_below",
             "right": {"factor": "BB_UPPER", "params": dict(bb_params)}},
        ],
        "buy_logic":  "AND",
        "sell_logic": "AND",
    }


STRATEGY_TYPE_SEEDS = [
    {
        "key": "ema_cross", "label": "EMA Cross", "group_": "Technical",
        "desc": "두 EMA의 골든/데스 크로스 - 추세 추종 전략",
        "slow_scan": False,
        "params": [
            {"key": "fast", "label": "Fast EMA", "min": 5,  "max": 30,  "step": 5,  "default": 20},
            {"key": "slow", "label": "Slow EMA", "min": 30, "max": 150, "step": 10, "default": 50},
        ],
        "template": _ema_cross(),
    },
    {
        "key": "rsi", "label": "RSI Mean Reversion", "group_": "Technical",
        "desc": "RSI 과매도/과매수 반전 - 평균 회귀 전략",
        "slow_scan": False,
        "params": [
            {"key": "rsi_period", "label": "RSI Period", "min": 7,  "max": 21, "step": 2, "default": 14},
            {"key": "oversold",   "label": "Oversold",   "min": 20, "max": 40, "step": 5, "default": 30},
            {"key": "overbought", "label": "Overbought", "min": 60, "max": 80, "step": 5, "default": 70},
        ],
        "template": _rsi(),
    },
    {
        "key": "macd_cross", "label": "MACD Cross", "group_": "Technical",
        "desc": "MACD 라인과 시그널 라인의 크로스오버",
        "slow_scan": False,
        "params": [
            {"key": "fast",   "label": "Fast",   "min": 8,  "max": 20, "step": 2, "default": 12},
            {"key": "slow",   "label": "Slow",   "min": 20, "max": 40, "step": 5, "default": 26},
            {"key": "signal", "label": "Signal", "min": 5,  "max": 15, "step": 2, "default": 9},
        ],
        "template": _macd_cross(),
    },
    {
        "key": "bb_breakout", "label": "Bollinger Reversion", "group_": "Technical",
        "desc": "볼린저 밴드 하단 반등 매수, 상단 저항 매도",
        "slow_scan": False,
        "params": [
            {"key": "period",  "label": "Period",  "min": 10,  "max": 30,  "step": 5,    "default": 20},
            {"key": "std_dev", "label": "Std Dev", "min": 1.5, "max": 3.0, "step": 0.25, "default": 2.0},
        ],
        "template": _bb_breakout(),
    },
    # Heston engines keep their native implementation (FFT computation can't
    # be expressed as factor conditions) - template=None signals native dispatch.
    {
        "key": "heston_vol_regime", "label": "Heston Vol Regime", "group_": "Heston",
        "desc": "실현변동성 / 장기평균(√θ) 비율로 저변동 국면 진입·고변동 국면 청산",
        "slow_scan": False,
        "params": [
            {"key": "entry_mult", "label": "Entry Mult", "min": 0.4, "max": 1.0, "step": 0.2, "default": 0.8},
            {"key": "exit_mult",  "label": "Exit Mult",  "min": 1.2, "max": 2.4, "step": 0.4, "default": 1.5},
        ],
        "template": None,
    },
    {
        "key": "heston_delta_signal", "label": "Heston Delta Signal", "group_": "Heston",
        "desc": "Heston 콜옵션 델타가 임계값 돌파 시 방향성 신호 (FFT 연산)",
        "slow_scan": True,
        "params": [
            {"key": "delta_buy",  "label": "Delta Buy",  "min": 0.50, "max": 0.70, "step": 0.05, "default": 0.60},
            {"key": "delta_sell", "label": "Delta Sell", "min": 0.30, "max": 0.50, "step": 0.05, "default": 0.40},
        ],
        "template": None,
    },
    {
        "key": "heston_price_ratio", "label": "Heston Premium MR", "group_": "Heston",
        "desc": "Heston 콜 프리미엄 Z-score 과열 시 역추세 매수, 붕괴 시 청산 (FFT 연산)",
        "slow_scan": True,
        "params": [
            {"key": "entry_z", "label": "Entry Z", "min": 1.0, "max": 2.5, "step": 0.5, "default": 1.5},
            {"key": "exit_z",  "label": "Exit Z",  "min": 0.2, "max": 1.0, "step": 0.2, "default": 0.5},
        ],
        "template": None,
    },
    {
        "key": "heston_variance_gap", "label": "Heston Variance Gap", "group_": "Heston",
        "desc": "분산갭(v0−θ) 수축 시 진입, −임계값 이하 시 스파이크 위험 청산",
        "slow_scan": False,
        "params": [
            {"key": "spike_thresh", "label": "Spike Thresh %", "min": 0.5, "max": 3.0, "step": 0.5, "default": 1.5},
            {"key": "low_thresh",   "label": "Low Thresh %",   "min": 0.1, "max": 1.0, "step": 0.3, "default": 0.5},
        ],
        "template": None,
    },
    {
        "key": "custom", "label": "Custom", "group_": "Custom",
        "desc": "Strategy Builder에서 직접 정의한 팩터 기반 전략",
        "slow_scan": False,
        "params": [],
        "template": None,
    },
]


def init_quant_strategy_types():
    db_path = Path(__file__).parent.parent / "data" / "marketpulse.db"
    db_instance = get_sqlite_db(str(db_path))
    Base.metadata.create_all(bind=db_instance.engine)
    session = db_instance.get_session()

    try:
        existing = {row.key: row for row in session.query(QuantStrategyType).all()}
        created, updated = 0, 0
        for seed in STRATEGY_TYPE_SEEDS:
            row = existing.get(seed["key"])
            payload = dict(
                label     = seed["label"],
                group_    = seed["group_"],
                desc      = seed["desc"],
                slow_scan = seed["slow_scan"],
                params    = json.dumps(seed["params"], ensure_ascii=False),
                template  = json.dumps(seed["template"], ensure_ascii=False) if seed["template"] else None,
                use_yn    = "Y",
            )
            if row:
                for k, v in payload.items():
                    setattr(row, k, v)
                updated += 1
            else:
                session.add(QuantStrategyType(key=seed["key"], **payload))
                created += 1
        session.commit()
        print(f"[OK] Strategy types seeded - created={created}, updated={updated}")
    except Exception as e:
        session.rollback()
        print(f"[FAIL] Strategy types seed failed: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    init_quant_strategy_types()
