"""SEC Fund Performance — 13F 보유종목 기반 분기별 추정 수익률.

연속한 두 분기의 13F 스냅샷을 비교해 분기 수익률을 추정한다. 핵심 아이디어는
13F가 종목별 `value`(달러)와 `shares`(주식 수)를 모두 신고한다는 점 —
`value / shares` 가 곧 **분기말 내재 주가(implied price)** 라서 외부 시세 소스
없이 자기완결적으로 종목 수익률을 뽑을 수 있다.

    r_i     = (value_cur_i / shares_cur_i) / (value_prev_i / shares_prev_i) - 1
    w_i     = value_prev_i / Σ(value_prev over matched)
    r_port  = Σ w_i · r_i

한계는 standard model(`standard_models/fund_performance.py`) 도큐스트링 참고.
특히 파생(Put/Call) 라인은 `value`가 옵션 시가가 아니라 기초자산 명목가치라
수익률로 환산할 수 없고 풋은 손익 부호가 반대라서 **산출에서 제외**하고,
그 비중을 `derivative_weight_pct`로 노출한다.
"""
import logging
from typing import Any, Dict, List, Optional

import requests

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.fund_performance import (
    FundPerformanceQueryParams,
    FundPerformanceData,
)
from data_fetcher.providers.sec.institutional_13f import SEC13FFetcher, _value_scale

log = logging.getLogger(__name__)

_HEADERS = {
    'User-Agent': 'MarketPulse research@marketpulse.com',
    'Accept-Encoding': 'gzip, deflate',
}

# implied price 비율이 이 범위를 벗어나면 주식분할/신고오류로 보고 제외한다.
# (13F는 분할 조정 주식 수를 신고하므로 2:1 분할이 -50% 수익률처럼 보인다.)
_MIN_PRICE_RATIO = 0.4
_MAX_PRICE_RATIO = 2.5


class SECFundPerformanceFetcher(
    ApiFetcher[FundPerformanceQueryParams, FundPerformanceData]
):
    """13F 연속 분기 비교로 추정 수익률을 산출하는 fetcher."""

    require_credentials = False  # SEC 데이터는 무료

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FundPerformanceQueryParams:
        return FundPerformanceQueryParams(**params)

    @staticmethod
    def _list_13f_filings(cik: str, limit: int) -> List[Dict[str, str]]:
        """submissions API에서 13F-HR 목록을 최신순으로 반환.

        browse-edgar 스크래핑 대신 submissions JSON을 쓰는 이유: 한 번의 요청으로
        `reportDate`(분기말)까지 정확히 얻는다. 제출일에서 분기말을 역산하면 지연/
        수정 제출에서 어긋난다.
        """
        url = f"https://data.sec.gov/submissions/CIK{cik.zfill(10)}.json"
        resp = requests.get(url, headers=_HEADERS, timeout=30)
        resp.raise_for_status()
        recent = (resp.json().get('filings') or {}).get('recent') or {}

        forms = recent.get('form', [])
        filings: List[Dict[str, str]] = []
        for i, form in enumerate(forms):
            if form != '13F-HR':  # 13F-HR/A(수정분)는 원본과 중복돼 제외
                continue
            accession = recent.get('accessionNumber', [])[i]
            filings.append({
                'accession': accession,
                'filing_date': recent.get('filingDate', [])[i],
                'period': recent.get('reportDate', [])[i],
            })
            if len(filings) >= limit:
                break
        return filings

    @staticmethod
    def _filing_index_url(cik: str, accession: str) -> str:
        """accession number → 필링 인덱스 페이지 URL (`_parse_filing` 입력용)."""
        return (
            f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/"
            f"{accession.replace('-', '')}/{accession}-index.htm"
        )

    @staticmethod
    def extract_data(
        query: FundPerformanceQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        inst_info = SEC13FFetcher._resolve_institution(query.institution_key)
        cik = inst_info['cik']

        quarters = max(2, int(query.quarters or 8))
        filings = SECFundPerformanceFetcher._list_13f_filings(cik, quarters)
        if len(filings) < 2:
            log.warning(
                "%s: 13F 제출이 %d건 — 분기 비교에 최소 2건 필요",
                inst_info['name'], len(filings),
            )
            return {'institution': inst_info, 'snapshots': []}

        # _parse_filing 은 인덱스 페이지를 받아 (holdings, filing_date) 를 돌려준다.
        # 파싱 헤더에 Host 가 필요해 기존 fetcher와 동일한 헤더 구성을 쓴다.
        parse_headers = {**_HEADERS, 'Host': 'www.sec.gov'}

        snapshots: List[Dict[str, Any]] = []
        for f in filings:
            index_url = SECFundPerformanceFetcher._filing_index_url(cik, f['accession'])
            try:
                holdings, _ = SEC13FFetcher._parse_filing(
                    index_url, parse_headers, filing_date=f['filing_date']
                )
            except Exception as e:  # noqa: BLE001 — 한 분기 실패가 전체를 죽이면 안 됨
                log.warning("13F 파싱 실패 (%s, %s): %s", f['period'], index_url, e)
                continue

            if not holdings:
                log.warning("13F 보유내역 없음 (%s)", f['period'])
                continue

            snapshots.append({
                'period': f['period'],
                'filing_date': f['filing_date'],
                'scale': _value_scale(f['filing_date']),
                'holdings': holdings,
            })

        # 오래된 분기 → 최신 분기 순으로 정렬(누적 수익률 계산 방향)
        snapshots.sort(key=lambda s: s['period'])
        return {'institution': inst_info, 'snapshots': snapshots}

    @staticmethod
    def _display_symbol(holding: Dict, cusip: str) -> str:
        """표시용 종목명. 티커가 없으면 발행사명으로 폴백.

        `cusip_to_ticker`는 매핑 실패 시 빈 문자열이 아니라 **CUSIP 앞 6자리**를
        돌려준다(예: 해외/ADR인 ASML → 'N07059'). 그대로 쓰면 기여도 종목이
        UI에서 식별 불가라, 그 경우를 감지해 nameOfIssuer를 쓴다.
        """
        symbol = (holding.get('symbol') or '').strip()
        if symbol and symbol != cusip[:6]:
            return symbol
        return (holding.get('name') or '').strip() or (cusip[:6] or '?')

    @staticmethod
    def _split_holdings(holdings: List[Dict]) -> tuple[Dict[str, Dict], float, float]:
        """보유내역 → (cusip별 보통주 포지션, 보통주 총액, 파생 명목가치 총액).

        같은 cusip이 여러 라인으로 쪼개져 신고되는 경우가 있어 value/shares를 합산한다.
        """
        equity: Dict[str, Dict] = {}
        equity_value = 0.0
        derivative_value = 0.0

        for h in holdings:
            value = float(h.get('value') or 0)
            if h.get('put_call'):  # Put/Call 라인 — 명목가치라 수익률 산출 불가
                derivative_value += value
                continue
            if h.get('share_type') != 'SH':  # PRN(채권 액면) 등은 주가 환산 불가
                continue

            shares = float(h.get('shares') or 0)
            if value <= 0 or shares <= 0:
                continue

            cusip = h.get('cusip') or ''
            if not cusip:
                continue

            equity_value += value
            if cusip in equity:
                equity[cusip]['value'] += value
                equity[cusip]['shares'] += shares
            else:
                equity[cusip] = {
                    'value': value,
                    'shares': shares,
                    'symbol': SECFundPerformanceFetcher._display_symbol(h, cusip),
                    'name': h.get('name') or '',
                }

        return equity, equity_value, derivative_value

    @staticmethod
    def _quarter_return(
        prev_eq: Dict[str, Dict], prev_eq_value: float, cur_eq: Dict[str, Dict]
    ) -> Dict[str, Any]:
        """연속 두 분기의 보통주 포지션 → 추정 수익률 + 기여도 + 신뢰도 지표."""
        contributions: List[tuple] = []  # (weight_base, r_i, symbol)
        matched_base = 0.0
        excluded = 0

        for cusip, p in prev_eq.items():
            c = cur_eq.get(cusip)
            if not c:  # 분기 중 전량 매도 — 매도 시점 가격을 알 수 없어 제외
                continue

            price_prev = p['value'] / p['shares']
            price_cur = c['value'] / c['shares']
            if price_prev <= 0:
                continue

            ratio = price_cur / price_prev
            if not (_MIN_PRICE_RATIO <= ratio <= _MAX_PRICE_RATIO):
                # 분할/병합 또는 신고 단위 오류로 판단 — 수익률을 오염시키므로 제외
                excluded += 1
                continue

            matched_base += p['value']
            contributions.append((p['value'], ratio - 1.0, p['symbol']))

        if not contributions or matched_base <= 0:
            return {
                'return_pct': None,
                'coverage_pct': 0.0,
                'matched_positions': 0,
                'excluded_positions': excluded,
                'top_contributor': None,
                'top_contributor_pct': None,
                'top_detractor': None,
                'top_detractor_pct': None,
            }

        weighted = [
            (base / matched_base, r, symbol) for base, r, symbol in contributions
        ]
        total_return = sum(w * r for w, r, _ in weighted)

        by_contribution = sorted(weighted, key=lambda x: x[0] * x[1])
        worst = by_contribution[0]
        best = by_contribution[-1]

        coverage = (matched_base / prev_eq_value * 100) if prev_eq_value > 0 else 0.0

        return {
            'return_pct': round(total_return * 100, 2),
            'coverage_pct': round(coverage, 1),
            'matched_positions': len(contributions),
            'excluded_positions': excluded,
            'top_contributor': best[2],
            'top_contributor_pct': round(best[0] * best[1] * 100, 2),
            'top_detractor': worst[2],
            'top_detractor_pct': round(worst[0] * worst[1] * 100, 2),
        }

    @staticmethod
    def transform_data(
        query: FundPerformanceQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[FundPerformanceData]:
        inst = data['institution']
        snapshots = data.get('snapshots') or []

        if len(snapshots) < 2:
            return []

        # 스냅샷당 한 번만 분해한다(인접 분기쌍이 각 스냅샷을 두 번 참조하므로
        # 루프 안에서 부르면 같은 필링을 중복 파싱하게 된다).
        splits = [
            SECFundPerformanceFetcher._split_holdings(s['holdings']) for s in snapshots
        ]

        rows: List[FundPerformanceData] = []
        cumulative = 1.0

        for i in range(1, len(snapshots)):
            prev, cur = snapshots[i - 1], snapshots[i]
            prev_eq, prev_eq_value, _ = splits[i - 1]
            cur_eq, cur_eq_value, cur_deriv_value = splits[i]

            metrics = SECFundPerformanceFetcher._quarter_return(
                prev_eq, prev_eq_value, cur_eq
            )

            if metrics['return_pct'] is not None:
                cumulative *= (1 + metrics['return_pct'] / 100)

            aum_change = (
                round((cur_eq_value / prev_eq_value - 1) * 100, 2)
                if prev_eq_value > 0 else None
            )
            reported_total = cur_eq_value + cur_deriv_value
            deriv_weight = (
                round(cur_deriv_value / reported_total * 100, 1)
                if reported_total > 0 else 0.0
            )

            rows.append(FundPerformanceData(
                institution_key=query.institution_key,
                name=inst['name'],
                manager=inst['manager'],
                period=cur['period'],
                filing_date=cur['filing_date'],
                return_pct=metrics['return_pct'],
                cumulative_return_pct=(
                    round((cumulative - 1) * 100, 2)
                    if metrics['return_pct'] is not None else None
                ),
                aum_change_pct=aum_change,
                total_value=cur_eq_value,
                num_holdings=len(cur_eq),
                coverage_pct=metrics['coverage_pct'],
                derivative_weight_pct=deriv_weight,
                matched_positions=metrics['matched_positions'],
                excluded_positions=metrics['excluded_positions'],
                top_contributor=metrics['top_contributor'],
                top_contributor_pct=metrics['top_contributor_pct'],
                top_detractor=metrics['top_detractor'],
                top_detractor_pct=metrics['top_detractor_pct'],
            ))

        rows.reverse()  # 최신 분기 먼저(위젯 표시 순서)
        log.info("%s: %d개 분기 추정 수익률 산출", inst['name'], len(rows))
        return rows
