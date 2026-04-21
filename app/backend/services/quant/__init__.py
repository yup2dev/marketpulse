"""Quant service sub-modules.

Indicator families split out of quant_service.py for maintainability:
  - technical : classical TA (EMA/SMA/RSI/MACD/BB/ATR/Stoch/VWAP/Z-score/percentile)
  - chart     : market structure (Volume Profile / Liquidity Sweep / HMM Regime)
  - options   : Carr-Madan FFT pricing (Black-Scholes / Heston) + realised var
"""
