"""13F 분석 — 비중 · 분기 대비 증감 · 신규/매도 판정 · 회전율, 분기 추정 수익률.

fetcher(sec institutional_13f)는 공시 원본 라인만 준다. 그 뒤의 분석은 provider 가 바뀌어도 같은 계산이라
fetcher 가 아니다. 13F 는 서버에서 파싱하지 않으므로(메모리) command 가 아니라 이 로컬 배치에서 계산해 적재한다.

입력 = SEC13FFilingData 를 dict 로 (holdings · previous_holdings 는 신고 라인 그대로).
출력 = 적재 shape 그대로의 dict (예전 whalewisdom InstitutionalHoldingsData · sec FundPerformanceData 와 같은 칸).
계산 규칙은 옮기기 전과 같다 (tests/test_13f_analysis.py).
"""
from typing import Any, Dict, List, Optional, Tuple

# implied price 비율이 이 범위를 벗어나면 주식분할/신고오류로 보고 제외한다.
# (13F는 분할 조정 주식 수를 신고하므로 2:1 분할이 -50% 수익률처럼 보인다.)
MIN_PRICE_RATIO = 0.4
MAX_PRICE_RATIO = 2.5


def _base(raw: Dict[str, Any], institution_key: str) -> Dict[str, Any]:
    filing_date = raw.get('filing_date') or '2024-12-31'
    return {
        'id': f"13f_{institution_key}",
        'institution_key': institution_key,
        'name': raw.get('name'),
        'manager': raw.get('manager'),
        'description': f"13F Holdings - {raw.get('name')}",
        'category': '13f',
        'source': 'SEC EDGAR',
        'filing_date': filing_date,
        'period_end': raw.get('report_period') or filing_date,
        'previous_filing_date': raw.get('previous_filing_date'),
        'performance': None,
        'top_sectors': None,
    }


# ── 요약 (커버페이지만) ──────────────────────────────────────────────────────

def summary(raw: Dict[str, Any], institution_key: str) -> Dict[str, Any]:
    """summary_only 공시 → 총가치 · 종목 수 · 직전 분기 대비 (AUM 스캔용)."""
    cur = raw.get('summary') or {}
    prev = raw.get('previous_summary') or {}
    total_value = cur.get('total_value', 0)
    prev_total = prev.get('total_value', 0)
    has_prev = prev_total > 0
    value_change = (total_value - prev_total) if has_prev else None
    return {
        **_base(raw, institution_key),
        'total_value': total_value,
        'num_holdings': cur.get('num_holdings', 0),
        'stocks': [],
        'sold_positions': [],
        'previous_value': prev_total if has_prev else None,
        'value_change': value_change,
        'value_change_pct': round(value_change / prev_total * 100, 2) if has_prev else None,
        'num_new_positions': 0, 'num_sold_out': 0, 'num_increased': 0, 'num_decreased': 0,
        'turnover': None,
    }


# ── 포트폴리오 (분기 대비) ────────────────────────────────────────────────────

def _holding(h: Dict[str, Any], symbol: str, cusip: str, **fields) -> Dict[str, Any]:
    return {'symbol': symbol, 'name': h.get('name'), 'cusip': cusip, 'value': h.get('value'),
            'shares': h.get('shares'), 'share_type': h.get('share_type'), **fields}


def portfolio(raw: Dict[str, Any], institution_key: str, limit: int = 1000) -> Optional[Dict[str, Any]]:
    """이번 · 직전 분기 공시 → 보통주(SH) 비중 · 종목별 분기 대비 · 매도 종목 · 포트폴리오 변화 · 회전율.

    보유 내역이 없으면 None.
    """
    current = raw.get('holdings') or []
    previous = raw.get('previous_holdings') or []
    if not current:
        return None

    # 직전 분기 조회표: CUSIP 우선, 심볼 폴백
    prev_by_cusip: Dict[str, Dict] = {}
    prev_by_symbol: Dict[str, Dict] = {}
    for h in previous:
        if h.get('share_type') == 'SH':
            if h.get('cusip'):
                prev_by_cusip[h['cusip']] = h
            if h.get('symbol'):
                prev_by_symbol[h['symbol']] = h
    has_previous = bool(prev_by_cusip or prev_by_symbol)

    total_value = sum(h['value'] for h in current if h.get('share_type') == 'SH')
    prev_total_value = sum(h['value'] for h in previous if h.get('share_type') == 'SH')

    matched_cusips, matched_symbols = set(), set()
    stocks: List[Dict[str, Any]] = []
    num_new = num_increased = num_decreased = 0
    turnover_value = 0.0

    for h in sorted(current, key=lambda x: x['value'], reverse=True)[:limit]:
        if h.get('share_type') != 'SH':
            continue
        weight = (h['value'] / total_value * 100) if total_value > 0 else 0
        cusip = h.get('cusip', '')
        symbol = h.get('symbol', '') or cusip[:6]

        prev = None
        if cusip and cusip in prev_by_cusip:
            prev = prev_by_cusip[cusip]
            matched_cusips.add(cusip)
        elif symbol and symbol in prev_by_symbol:
            prev = prev_by_symbol[symbol]
            matched_symbols.add(symbol)

        q: Dict[str, Any] = {'prev_shares': None, 'prev_value': None, 'share_change': None,
                             'share_change_pct': None, 'value_change': None, 'value_change_pct': None,
                             'status': None}
        if has_previous:
            if prev:
                share_change = h['shares'] - prev['shares']
                value_change = h['value'] - prev['value']
                q.update(
                    prev_shares=prev['shares'], prev_value=prev['value'], share_change=share_change,
                    share_change_pct=round(share_change / prev['shares'] * 100, 2) if prev['shares'] > 0 else None,
                    value_change=value_change,
                    value_change_pct=round(value_change / prev['value'] * 100, 2) if prev['value'] > 0 else None,
                )
                if share_change > 0:
                    q['status'] = 'increased'
                    num_increased += 1
                elif share_change < 0:
                    q['status'] = 'decreased'
                    num_decreased += 1
                else:
                    q['status'] = 'unchanged'
                price = (h['value'] / h['shares']) if h['shares'] > 0 else 0
                turnover_value += abs(share_change * price)
            else:
                q['status'] = 'new'
                num_new += 1

        stocks.append(_holding(h, symbol, cusip, weight=round(weight, 2), **q))

    # 직전 분기에 있었고 이번 분기에 없는 종목 = 매도
    sold: List[Dict[str, Any]] = []
    if has_previous:
        current_sh = [c for c in current if c.get('share_type') == 'SH']
        for h in previous:
            if h.get('share_type') != 'SH':
                continue
            cusip = h.get('cusip', '')
            symbol = h.get('symbol', '') or cusip[:6]
            if (cusip and cusip in matched_cusips) or (symbol and symbol in matched_symbols):
                continue
            if any((cusip and c.get('cusip') == cusip) or (symbol and c.get('symbol') == symbol) for c in current_sh):
                continue
            sold.append(_holding(
                h, symbol, cusip, weight=0.0, share_type=h.get('share_type', 'SH'),
                prev_shares=h['shares'], prev_value=h['value'], share_change=-h['shares'],
                share_change_pct=-100.0, value_change=-h['value'], value_change_pct=-100.0, status='sold',
            ))

    value_change = total_value - prev_total_value if has_previous else 0
    value_change_pct = ((value_change / prev_total_value * 100) if prev_total_value > 0 else 0) if has_previous else 0

    return {
        **_base(raw, institution_key),
        'total_value': total_value,
        'num_holdings': len([h for h in current if h.get('share_type') == 'SH']),
        'stocks': stocks,
        'sold_positions': sold,
        'previous_value': prev_total_value if has_previous else None,
        'value_change': value_change if has_previous else None,
        'value_change_pct': round(value_change_pct, 2) if has_previous else None,
        'num_new_positions': num_new,
        'num_sold_out': len(sold),
        'num_increased': num_increased,
        'num_decreased': num_decreased,
        'turnover': round((turnover_value / total_value * 100) if total_value > 0 else 0.0, 2),
    }


# ── 분기 추정 수익률 ─────────────────────────────────────────────────────────
#
# 13F 는 종목별 value(달러)와 shares 를 모두 신고한다 — value / shares 가 곧 분기말 내재 주가라
# 외부 시세 없이 종목 수익률을 뽑는다.
#     r_i = (value_cur_i / shares_cur_i) / (value_prev_i / shares_prev_i) - 1
#     w_i = value_prev_i / Σ(value_prev over matched),   r_port = Σ w_i · r_i
# 파생(Put/Call) 라인은 value 가 기초자산 명목가치라 수익률로 못 바꾸고 풋은 부호가 반대라 제외하고,
# 그 비중을 derivative_weight_pct 로 낸다.

def _display_symbol(h: Dict, cusip: str) -> str:
    """표시용 종목명 — 티커 매핑 실패(CUSIP 앞 6자리)면 발행사명으로."""
    symbol = (h.get('symbol') or '').strip()
    if symbol and symbol != cusip[:6]:
        return symbol
    return (h.get('name') or '').strip() or (cusip[:6] or '?')


def split_holdings(holdings: List[Dict]) -> Tuple[Dict[str, Dict], float, float]:
    """보유내역 → (cusip별 보통주 포지션, 보통주 총액, 파생 명목가치 총액). 같은 cusip 여러 라인은 합친다."""
    equity: Dict[str, Dict] = {}
    equity_value = derivative_value = 0.0
    for h in holdings:
        value = float(h.get('value') or 0)
        if h.get('put_call'):
            derivative_value += value
            continue
        if h.get('share_type') != 'SH':
            continue
        shares = float(h.get('shares') or 0)
        cusip = h.get('cusip') or ''
        if value <= 0 or shares <= 0 or not cusip:
            continue
        equity_value += value
        if cusip in equity:
            equity[cusip]['value'] += value
            equity[cusip]['shares'] += shares
        else:
            equity[cusip] = {'value': value, 'shares': shares, 'symbol': _display_symbol(h, cusip),
                             'name': h.get('name') or ''}
    return equity, equity_value, derivative_value


def quarter_return(prev_eq: Dict[str, Dict], prev_eq_value: float, cur_eq: Dict[str, Dict]) -> Dict[str, Any]:
    """연속 두 분기 보통주 포지션 → 추정 수익률 + 기여도 + 신뢰도 지표."""
    contributions: List[tuple] = []
    matched_base = 0.0
    excluded = 0
    for cusip, p in prev_eq.items():
        c = cur_eq.get(cusip)
        if not c:                                  # 분기 중 전량 매도 — 매도 시점 가격을 몰라 제외
            continue
        price_prev = p['value'] / p['shares']
        if price_prev <= 0:
            continue
        ratio = (c['value'] / c['shares']) / price_prev
        if not (MIN_PRICE_RATIO <= ratio <= MAX_PRICE_RATIO):
            excluded += 1                          # 분할 · 병합 · 신고 단위 오류
            continue
        matched_base += p['value']
        contributions.append((p['value'], ratio - 1.0, p['symbol']))

    if not contributions or matched_base <= 0:
        return {'return_pct': None, 'coverage_pct': 0.0, 'matched_positions': 0, 'excluded_positions': excluded,
                'top_contributor': None, 'top_contributor_pct': None, 'top_detractor': None,
                'top_detractor_pct': None}

    weighted = [(base / matched_base, r, symbol) for base, r, symbol in contributions]
    total_return = sum(w * r for w, r, _ in weighted)
    by_contribution = sorted(weighted, key=lambda x: x[0] * x[1])
    worst, best = by_contribution[0], by_contribution[-1]
    return {
        'return_pct': round(total_return * 100, 2),
        'coverage_pct': round((matched_base / prev_eq_value * 100) if prev_eq_value > 0 else 0.0, 1),
        'matched_positions': len(contributions),
        'excluded_positions': excluded,
        'top_contributor': best[2],
        'top_contributor_pct': round(best[0] * best[1] * 100, 2),
        'top_detractor': worst[2],
        'top_detractor_pct': round(worst[0] * worst[1] * 100, 2),
    }


def fund_performance(snapshots: List[Dict[str, Any]], institution_key: str,
                     name: Optional[str], manager: Optional[str]) -> List[Dict[str, Any]]:
    """분기 스냅샷 [{period, filing_date, holdings}] → 분기별 추정 수익률 행 (최신 분기 먼저).

    스냅샷이 2개 미만이면 빈 목록.
    """
    snapshots = sorted((s for s in snapshots if s.get('holdings')), key=lambda s: s['period'])
    if len(snapshots) < 2:
        return []
    splits = [split_holdings(s['holdings']) for s in snapshots]

    rows: List[Dict[str, Any]] = []
    cumulative = 1.0
    for i in range(1, len(snapshots)):
        cur = snapshots[i]
        prev_eq, prev_eq_value, _ = splits[i - 1]
        cur_eq, cur_eq_value, cur_deriv_value = splits[i]
        m = quarter_return(prev_eq, prev_eq_value, cur_eq)
        if m['return_pct'] is not None:
            cumulative *= (1 + m['return_pct'] / 100)
        reported_total = cur_eq_value + cur_deriv_value
        rows.append({
            'institution_key': institution_key, 'name': name, 'manager': manager,
            'period': cur['period'], 'filing_date': cur['filing_date'],
            'return_pct': m['return_pct'],
            'cumulative_return_pct': round((cumulative - 1) * 100, 2) if m['return_pct'] is not None else None,
            'aum_change_pct': round((cur_eq_value / prev_eq_value - 1) * 100, 2) if prev_eq_value > 0 else None,
            'total_value': cur_eq_value,
            'num_holdings': len(cur_eq),
            'coverage_pct': m['coverage_pct'],
            'derivative_weight_pct': round(cur_deriv_value / reported_total * 100, 1) if reported_total > 0 else 0.0,
            'matched_positions': m['matched_positions'],
            'excluded_positions': m['excluded_positions'],
            'top_contributor': m['top_contributor'],
            'top_contributor_pct': m['top_contributor_pct'],
            'top_detractor': m['top_detractor'],
            'top_detractor_pct': m['top_detractor_pct'],
        })
    rows.reverse()
    return rows
