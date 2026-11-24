"""산업 카탈로그 서비스 — 산업 목록 · 데이터셋(+계열) 목록.

정의는 DB 행 (models/industry_catalog.py). 시드(services/industry_seed.py)에 있는데 DB 에 없는
산업은 처음 읽을 때 넣는다 — 있는 행은 그대로 둔다 (빼려면 use_yn=N).
"""
from typing import Dict, List, Optional
from urllib.parse import parse_qsl

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.backend.models.industry_catalog import (
    Industry, IndustryDataset, IndustryDatasetSeries, IndustrySector,
)


# ── 응답 모델 (라우트가 OBBject[List[...]] 로 내보낸다) ──────────────────────────

class IndustrySectorOut(BaseModel):
    market: str = Field(description="시장 (종목 마스터 country) — KR · US")
    match_field: str = Field(description="종목 마스터에서 대조할 컬럼 — sector(KSIC) · industry(GICS)")
    sector_name: str = Field(description="업종 이름 (그 컬럼의 값 그대로)")


class IndustryOut(BaseModel):
    industry: str = Field(description="산업 코드 (예: semiconductor)")
    name: str = Field(description="산업 이름")
    is_new: bool = Field(default=False, description="목록에 NEW 표시")
    dataset_count: int = Field(default=0, description="데이터셋 수 — 0 이면 준비 중")
    sectors: List[IndustrySectorOut] = Field(default_factory=list, description="관련 기업을 고르는 업종")


class IndustrySeriesOut(BaseModel):
    code: str = Field(description="계열 코드 (예: dram)")
    label: str = Field(description="칩에 보일 이름")
    params: Dict[str, str] = Field(default_factory=dict, description="이 계열을 부를 때 덧붙일 파라미터")


class IndustryDatasetOut(BaseModel):
    dataset: str = Field(description="데이터셋 ID (예: semi-exports)")
    industry: str = Field(description="산업 코드")
    group: Optional[str] = Field(default=None, description="목록 안의 묶음 (수출 · 생산)")
    name: str = Field(description="데이터셋 이름")
    provider: str = Field(description="provider — /api/data/{provider}/{model}")
    model: str = Field(description="provider 모델")
    params: Dict[str, str] = Field(default_factory=dict, description="모든 계열에 붙는 파라미터")
    series: List[IndustrySeriesOut] = Field(default_factory=list, description="계열 (차트 위 칩)")
    frequency: str = Field(default="M", description="M 월 · Q 분기 · Y 연")
    unit: Optional[str] = Field(default=None, description="단위")
    source: Optional[str] = Field(default=None, description="출처 기관")
    note: Optional[str] = Field(default=None, description="비고")


def _qs(text: Optional[str]) -> Dict[str, str]:
    return dict(parse_qsl(text or "", keep_blank_values=True))


# ── 시드 ──────────────────────────────────────────────────────────────────────

def _seed_missing(db: Session) -> bool:
    """시드 중 DB 에 없는 산업(과 그 데이터셋 · 계열 · 업종)만 넣는다. 넣은 게 있으면 True."""
    from app.backend.services.industry_seed import INDUSTRIES

    existing = {code for (code,) in db.query(Industry.industry_code).all()}
    added = False
    for seq, ind in enumerate(INDUSTRIES):
        if ind["industry_code"] in existing:
            continue
        code = ind["industry_code"]
        db.add(Industry(industry_code=code, name=ind["name"], sort_seq=seq * 10,
                        new_yn="Y" if ind.get("new") else "N", use_yn="Y"))
        for dseq, ds in enumerate(ind["datasets"]):
            db.add(IndustryDataset(
                dataset_id=ds["dataset_id"], industry_code=code, group_name=ds["group"], name=ds["name"],
                provider=ds.get("provider", "kosis"), model=ds["model"], params=ds["params"] or None,
                frequency=ds.get("frequency", "M"), unit=ds["unit"], source=ds["source"], note=ds["note"] or None,
                sort_seq=dseq * 10, use_yn="Y",
            ))
            for sseq, s in enumerate(ds["series"]):
                db.add(IndustryDatasetSeries(dataset_id=ds["dataset_id"], series_seq=sseq, **s))
        for market, field, sector in ind["sectors"]:
            db.add(IndustrySector(industry_code=code, market=market, match_field=field, sector_name=sector))
        added = True
    if added:
        db.commit()
    return added


# ── 조회 ──────────────────────────────────────────────────────────────────────

class IndustryService:

    @staticmethod
    def list_industries(db: Session) -> List[IndustryOut]:
        """사용 중인 산업 — 정렬 순서대로, 데이터셋 수와 관련 업종 포함."""
        _seed_missing(db)
        inds = (db.query(Industry).filter(Industry.use_yn == "Y")
                .order_by(Industry.sort_seq, Industry.industry_code).all())
        counts: Dict[str, int] = {}
        for (code,) in db.query(IndustryDataset.industry_code).filter(IndustryDataset.use_yn == "Y").all():
            counts[code] = counts.get(code, 0) + 1
        sectors: Dict[str, List[IndustrySectorOut]] = {}
        for s in db.query(IndustrySector).order_by(IndustrySector.market, IndustrySector.sector_name).all():
            sectors.setdefault(s.industry_code, []).append(
                IndustrySectorOut(market=s.market, match_field=s.match_field, sector_name=s.sector_name))
        return [
            IndustryOut(industry=i.industry_code, name=i.name, is_new=i.new_yn == "Y",
                        dataset_count=counts.get(i.industry_code, 0), sectors=sectors.get(i.industry_code, []))
            for i in inds
        ]

    @staticmethod
    def list_datasets(db: Session, industry: Optional[str] = None) -> List[IndustryDatasetOut]:
        """사용 중인 데이터셋(+계열). industry 를 주면 그 산업만."""
        _seed_missing(db)
        q = (db.query(IndustryDataset)
             .join(Industry, Industry.industry_code == IndustryDataset.industry_code)
             .filter(IndustryDataset.use_yn == "Y", Industry.use_yn == "Y"))
        if industry:
            q = q.filter(IndustryDataset.industry_code == industry)
        datasets = q.order_by(Industry.sort_seq, IndustryDataset.sort_seq, IndustryDataset.dataset_id).all()
        ids = [d.dataset_id for d in datasets]
        series: Dict[str, List[IndustrySeriesOut]] = {}
        if ids:
            rows = (db.query(IndustryDatasetSeries).filter(IndustryDatasetSeries.dataset_id.in_(ids))
                    .order_by(IndustryDatasetSeries.dataset_id, IndustryDatasetSeries.series_seq).all())
            for s in rows:
                series.setdefault(s.dataset_id, []).append(
                    IndustrySeriesOut(code=s.series_code, label=s.label, params=_qs(s.series_params)))
        return [
            IndustryDatasetOut(
                dataset=d.dataset_id, industry=d.industry_code, group=d.group_name, name=d.name,
                provider=d.provider, model=d.model, params=_qs(d.params), series=series.get(d.dataset_id, []),
                frequency=d.frequency, unit=d.unit, source=d.source, note=d.note,
            )
            for d in datasets
        ]


# ── 데이터셋 데이터 (위젯이 그대로 그리는 행) ─────────────────────────────────────

class IndustryDataRow(BaseModel):
    date: str = Field(description="시점 (YYYY-MM-DD, 기간 첫날)")
    series: str = Field(description="실제로 그린 계열 코드 — 모르는 계열을 주면 첫 계열이라 화면이 이 값으로 맞춘다")
    value: Optional[float] = Field(default=None, description="값 (단위는 metadata.unit)")
    rate: Optional[float] = Field(default=None, description="고른 증감률 (%) — rate=yoy · mom, none 이면 비움")
    yoy: Optional[float] = Field(default=None, description="전년 같은 기간 대비 (%)")
    mom: Optional[float] = Field(default=None, description="직전 기간 대비 (%)")


class IndustryCard(BaseModel):
    key: str = Field(description="카드 키")
    label: str = Field(description="카드 이름")
    value: str = Field(description="표기된 값")
    hint: Optional[str] = Field(default=None, description="설명")
    tone: Optional[float] = Field(default=None, description="색을 정하는 부호 (등락)")


class IndustryCompany(BaseModel):
    symbol: str = Field(description="종목 코드")
    name: Optional[str] = Field(default=None, description="종목명")
    market: str = Field(description="KR · US")
    sector: Optional[str] = Field(default=None, description="업종 (종목 마스터 값)")
    close: Optional[float] = Field(default=None, description="최근 종가")
    change_rate: Optional[float] = Field(default=None, description="최근 등락률 (%)")
    as_of: Optional[str] = Field(default=None, description="종가 기준일 (종목마다 다를 수 있다)")


PERIOD_MONTHS: Dict[str, Optional[int]] = {"1y": 12, "3y": 36, "5y": 60, "10y": 120, "max": None}
_FETCH_YEARS = 10   # 차트 · 카드 · 표가 같은 요청(같은 캐시)을 쓰게 늘 10년을 받고 잘라 쓴다


def _series_of(db: Session, dataset_id: str):
    ds = (db.query(IndustryDataset)
          .filter(IndustryDataset.dataset_id == dataset_id, IndustryDataset.use_yn == "Y").one_or_none())
    if ds is None:
        raise ValueError(f"unknown dataset: {dataset_id}")
    series = (db.query(IndustryDatasetSeries).filter(IndustryDatasetSeries.dataset_id == dataset_id)
              .order_by(IndustryDatasetSeries.series_seq).all())
    return ds, series


def list_series(db: Session, dataset_id: str) -> List[IndustrySeriesOut]:
    """데이터셋의 계열 — 차트 머리줄의 계열 선택지."""
    _seed_missing(db)
    _, series = _series_of(db, dataset_id)
    return [IndustrySeriesOut(code=s.series_code, label=s.label, params=_qs(s.series_params)) for s in series]


async def _fetch(db: Session, dataset_id: str, series_code: Optional[str]):
    """데이터셋 + 계열 → provider 모델 한 번 (QueryExecutor — 사용자 키 · 캐시 · 서킷브레이커).

    모르는 계열 코드(데이터셋을 바꾼 직후 예전 계열)는 첫 계열로 — 화면이 오류 대신 데이터를 보인다.
    """
    from datetime import date

    from data_fetcher.core.obbject import OBBject
    from data_fetcher.query_executor import QueryExecutor

    _seed_missing(db)
    ds, series = _series_of(db, dataset_id)
    if not series:
        raise ValueError(f"dataset has no series: {dataset_id}")
    chosen = next((s for s in series if s.series_code == series_code), series[0])
    params = {**_qs(ds.params), **_qs(chosen.series_params),
              "start_date": date(date.today().year - _FETCH_YEARS, 1, 1).isoformat()}
    raw = await QueryExecutor.fetch(ds.provider, ds.model, params)
    rows = []
    for r in OBBject.unwrap(raw) or []:
        d = r.model_dump() if hasattr(r, "model_dump") else dict(r)
        rows.append({"date": str(d.get("date"))[:10], "value": d.get("value"), "yoy": d.get("yoy"), "mom": d.get("mom")})
    rows.sort(key=lambda r: r["date"])
    meta = {
        **OBBject.metadata_of(raw),
        "dataset": ds.dataset_id, "name": ds.name, "unit": ds.unit, "source": ds.source, "note": ds.note,
        "frequency": ds.frequency, "series": chosen.series_code, "series_label": chosen.label,
    }
    return ds, rows, meta


def _since(rows: List[dict], months: Optional[int]) -> List[dict]:
    """마지막 시점에서 months 개월 (그 달 포함)."""
    if not months or not rows:
        return rows
    last = rows[-1]["date"]
    y, m = divmod(int(last[:4]) * 12 + int(last[5:7]) - 1 - (months - 1), 12)
    first = f"{y:04d}-{m + 1:02d}-01"
    return [r for r in rows if r["date"] >= first]


async def dataset_data(db: Session, dataset_id: str, series: Optional[str] = None, period: str = "5y",
                       rate: str = "yoy", order: str = "asc", limit: Optional[int] = None):
    """차트 · 표가 그대로 그리는 행 — 기간만큼, rate 칸 = 고른 증감률. → (provider, rows, metadata)"""
    if period not in PERIOD_MONTHS:
        raise ValueError(f"period must be one of {', '.join(PERIOD_MONTHS)}")
    if rate not in ("yoy", "mom", "none"):
        raise ValueError("rate must be yoy · mom · none")
    ds, rows, meta = await _fetch(db, dataset_id, series)
    rows = _since(rows, PERIOD_MONTHS[period])
    out = [IndustryDataRow(**r, series=meta["series"], rate=None if rate == "none" else r.get(rate)) for r in rows]
    if order == "desc":
        out.reverse()
    if limit:
        out = out[:limit]
    return ds.provider, out, {**meta, "period": period, "rate": rate}


def _fmt(v: Optional[float], unit: Optional[str]) -> str:
    if v is None:
        return "—"
    if unit == "USD":
        for div, suf in ((1e9, "B"), (1e6, "M"), (1e3, "K")):
            if abs(v) >= div:
                return f"${v / div:,.2f}{suf}"
        return f"${v:,.0f}"
    return f"{v:,.1f}"


def _pct(v: Optional[float]) -> str:
    return "—" if v is None else f"{v:+.1f}%"


async def dataset_summary(db: Session, dataset_id: str, series: Optional[str] = None):
    """요약 카드 — 최신 · 전년 대비 · 직전 대비 · 최근 3기간 평균 YoY · 올해 누적(금액) / 1년 평균(지수) · 1년 최고·최저."""
    ds, rows, meta = await _fetch(db, dataset_id, series)
    if not rows:
        return ds.provider, [], meta
    last = rows[-1]
    unit = ds.unit
    recent = [r["yoy"] for r in rows[-3:] if r["yoy"] is not None]
    avg3 = sum(recent) / len(recent) if recent else None
    year = _since(rows, 12)
    valued = [r for r in year if r["value"] is not None]
    hi = max(valued, key=lambda r: r["value"], default=None)
    lo = min(valued, key=lambda r: r["value"], default=None)
    cards = [
        IndustryCard(key="latest", label=f"최신 ({last['date'][:7]})", value=_fmt(last["value"], unit), hint=unit),
        IndustryCard(key="yoy", label="전년 대비", value=_pct(last["yoy"]), tone=last["yoy"]),
        IndustryCard(key="mom", label="직전 대비", value=_pct(last["mom"]), tone=last["mom"]),
        IndustryCard(key="avg3", label="최근 3기간 평균 YoY", value=_pct(avg3), tone=avg3),
    ]
    if unit == "USD":   # 금액(흐름) — 올해 누적을 작년 같은 기간과
        this_year = last["date"][:4]
        prev_year = str(int(this_year) - 1)
        months = {r["date"][5:7] for r in rows if r["date"][:4] == this_year}
        now_sum = sum(r["value"] or 0 for r in rows if r["date"][:4] == this_year)
        prev_sum = sum(r["value"] or 0 for r in rows if r["date"][:4] == prev_year and r["date"][5:7] in months)
        ytd = (now_sum / prev_sum - 1) * 100 if prev_sum else None
        cards.append(IndustryCard(key="ytd", label="올해 누적 (YTD)", value=_pct(ytd), tone=ytd,
                                  hint=f"{this_year}년 {len(months)}개월 합계, 전년 같은 기간 대비"))
    else:               # 지수(수준) — 1년 평균
        vals = [r["value"] for r in valued]
        cards.append(IndustryCard(key="avg12", label="1년 평균",
                                  value=_fmt(sum(vals) / len(vals) if vals else None, unit), hint=unit))
    if hi and lo:
        cards.append(IndustryCard(key="range", label="1년 최고 · 최저",
                                  value=f"{_fmt(hi['value'], unit)} · {_fmt(lo['value'], unit)}",
                                  hint=f"최고 {hi['date'][:7]} · 최저 {lo['date'][:7]}"))
    return ds.provider, cards, meta


def related_companies(db: Session, industry: str, limit: int = 40) -> List[IndustryCompany]:
    """산업의 업종(industry_sectors)에 속한 종목 — 종목 마스터 + 종목마다 가장 최근 일봉의 종가 · 등락률."""
    from sqlalchemy import func, or_

    from app.backend.models.orm import MBS_IN_STBD_MST, MBS_IN_STK_STBD

    _seed_missing(db)
    sectors = db.query(IndustrySector).filter(IndustrySector.industry_code == industry).all()
    stocks = []
    for s in sectors:
        col = MBS_IN_STBD_MST.industry if s.match_field == "industry" else MBS_IN_STBD_MST.sector
        stocks += (db.query(MBS_IN_STBD_MST)
                   .filter(MBS_IN_STBD_MST.country == s.market, col == s.sector_name)
                   .filter(or_(MBS_IN_STBD_MST.is_active.is_(None), MBS_IN_STBD_MST.is_active == True))  # noqa: E712
                   .all())
    codes = list({m.ticker_cd for m in stocks})
    latest = {}
    if codes:
        last = (db.query(MBS_IN_STK_STBD.stk_cd, func.max(MBS_IN_STK_STBD.base_ymd).label("d"))
                .filter(MBS_IN_STK_STBD.stk_cd.in_(codes)).group_by(MBS_IN_STK_STBD.stk_cd).subquery())
        rows = (db.query(MBS_IN_STK_STBD)
                .join(last, (MBS_IN_STK_STBD.stk_cd == last.c.stk_cd) & (MBS_IN_STK_STBD.base_ymd == last.c.d)).all())
        latest = {r.stk_cd: r for r in rows}
    seen, out = set(), []
    for m in stocks:
        if m.ticker_cd in seen:
            continue
        seen.add(m.ticker_cd)
        p = latest.get(m.ticker_cd)
        out.append(IndustryCompany(
            symbol=m.ticker_cd, name=m.ticker_nm, market=m.country,
            sector=m.industry if m.country == "US" else m.sector,
            close=float(p.close_price) if p is not None and p.close_price is not None else None,
            change_rate=float(p.change_rate) if p is not None and p.change_rate is not None else None,
            as_of=p.base_ymd.isoformat() if p is not None and p.base_ymd else None,
        ))
    # 시세가 있는 종목 먼저 (KR → US), 그다음 이름순
    out.sort(key=lambda c: (c.close is None, c.market != "KR", c.name or c.symbol))
    return out[:limit]
