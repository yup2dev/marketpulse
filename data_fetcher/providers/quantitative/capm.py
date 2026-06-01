"""CAPM fetcher — α/β/R²/risk decomposition vs benchmark."""
import logging
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from scipy import stats

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.providers.quantitative._data import (
    annualise_return,
    annualise_vol,
    load_series,
)
from data_fetcher.providers.quantitative.analysis import CAPMData, CAPMQueryParams

log = logging.getLogger(__name__)


class QuantCAPMFetcher(Fetcher[CAPMQueryParams, CAPMData]):
    """Regress asset excess returns on market excess returns."""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> CAPMQueryParams:
        return CAPMQueryParams(**params)

    @staticmethod
    def extract_data(
        query: CAPMQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        # always use returns (target=close → derive returns inside the helper)
        _, asset_ret = load_series(query.symbol, "close", query.start_date, query.end_date)
        _, mkt_ret = load_series(query.benchmark, "close", query.start_date, query.end_date)

        df = pd.concat(
            {"asset": asset_ret, "mkt": mkt_ret}, axis=1, join="inner"
        ).dropna()

        if len(df) < 30:
            raise ValueError(
                f"Need ≥30 overlapping observations for CAPM (got {len(df)})."
            )

        rf_daily = (1.0 + query.risk_free_rate) ** (1.0 / 252) - 1.0
        ex_a = df["asset"] - rf_daily
        ex_m = df["mkt"] - rf_daily

        slope, intercept, r_value, _, _ = stats.linregress(ex_m.values, ex_a.values)
        beta = float(slope)
        alpha_daily = float(intercept)
        alpha_ann = (1.0 + alpha_daily) ** 252 - 1.0
        r2 = float(r_value ** 2)
        corr = float(np.corrcoef(ex_a.values, ex_m.values)[0, 1])

        var_m_ann = float(ex_m.var(ddof=1) * 252)
        var_a_ann = float(ex_a.var(ddof=1) * 252)
        systematic_ann = beta ** 2 * var_m_ann
        unsystematic_ann = max(var_a_ann - systematic_ann, 0.0)

        ann_ret = annualise_return(df["asset"])
        ann_vol = annualise_vol(df["asset"])
        sharpe = (ann_ret - query.risk_free_rate) / ann_vol if ann_vol > 0 else 0.0

        return {
            "symbol": query.symbol,
            "benchmark": query.benchmark,
            "n": int(len(df)),
            "alpha": alpha_ann,
            "beta": beta,
            "r_squared": r2,
            "correlation": corr,
            "systematic_risk": systematic_ann,
            "unsystematic_risk": unsystematic_ann,
            "total_risk": var_a_ann,
            "annualised_return": ann_ret,
            "annualised_volatility": ann_vol,
            "sharpe_ratio": float(sharpe),
        }

    @staticmethod
    def transform_data(
        query: CAPMQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[CAPMData]:
        return [CAPMData.model_validate(data)]
