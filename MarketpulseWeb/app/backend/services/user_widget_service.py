"""위젯 설정 — 사용자 정의 위젯(API → 매핑 → 위젯 → 화면 등록)과 위젯 목록 관리.

테이블 구성은 models/orm/user.py 의 주석 참고. 이 모듈은
  - 코드값(CODES)·화면 변수(VARIABLES)의 단일 기준
  - 위젯 종류 목록(widget_types) — 관리자가 고치는 목록. 처음 읽을 때 기본 행을 넣는다
  - 사용자 정의 위젯의 검증·CRUD (자식 행은 저장할 때 통째로 바꾼다)
  - 기본 제공 위젯의 사용자별 설정(사용 여부·내놓을 화면)
  - 기본 제공 위젯의 정의(user_id NULL 인 행) — 처음 읽을 때 시드를 넣고, 화면이 그릴 모양으로 돌려준다
을 맡는다.
"""
import re
import uuid
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qsl

from sqlalchemy.orm import Session

from app.backend.models.orm import (
    UserWidget, UserWidgetField, UserWidgetOption, UserWidgetParam, UserWidgetParamOption,
    UserWidgetPref, UserWidgetPrefScreen, UserWidgetScreen, UserWidgetTab, UserWidgetTabItem,
    WidgetType,
)

# ── 고정 코드값 — 설정 화면의 선택지 ──────────────────────────────────────────
# { 코드그룹: [{ value, name, ... }] }.  프론트는 이 목록으로 select 를 그리고,
# 서버는 같은 목록으로 저장 값을 검증한다 (한 곳만 고치면 양쪽이 따라온다).
# 위젯 종류(VIEW_TYPE)는 여기 없다 — DB(widget_types)에서 읽어 get_codes() 가 합친다.
CODES: Dict[str, List[Dict[str, Any]]] = {
    # 실제로 그리는 방식. 그리는 코드가 프론트(UniversalWidget)에 있는 것만 올 수 있다.
    # kind 는 매핑 화면이 어떤 자리를 요구할지 정한다.
    "RENDERER": [
        {"value": "table",      "name": "표",        "kind": "table"},
        {"value": "line",       "name": "선 차트",    "kind": "chart"},
        {"value": "area",       "name": "영역 차트",  "kind": "chart"},
        {"value": "bar",        "name": "막대 차트",  "kind": "chart"},
        {"value": "stackedBar", "name": "누적 막대",  "kind": "chart"},
        {"value": "pie",        "name": "파이",       "kind": "chart"},
        {"value": "donut",      "name": "도넛",       "kind": "chart"},
        {"value": "kv",         "name": "요약 카드",  "kind": "kv"},
    ],
    # API 파라미터에 값을 대는 방법
    "BIND_TYPE": [
        {"value": "FIXED", "name": "고정값"},
        {"value": "VAR",   "name": "화면 변수"},
        {"value": "INPUT", "name": "사용자 입력"},
    ],
    # 응답 필드를 위젯의 어느 자리에 쓸지
    "FIELD_ROLE": [
        {"value": "COLUMN",  "name": "표 컬럼"},
        {"value": "X",       "name": "차트 가로축"},
        {"value": "Y",       "name": "차트 값"},
        {"value": "PRIMARY", "name": "요약 타일"},
        {"value": "HIDDEN",  "name": "숨김"},
    ],
    "FIELD_FORMAT": [
        {"value": "auto",      "name": "자동"},
        {"value": "number",    "name": "숫자"},
        {"value": "percent",   "name": "퍼센트"},
        {"value": "currency",  "name": "통화"},
        {"value": "magnitude", "name": "큰 수 (K·M·B)"},
        {"value": "date",      "name": "날짜"},
        {"value": "none",      "name": "원문 그대로"},
    ],

    # ── 기본 제공 위젯(user_id NULL)의 코드값 — 그리는 코드는 프론트 mp-widgets 에 있다 ──
    # 뷰 종류 (user_widgets.view_type)
    "SPEC_VIEW": [
        {"value": "tiles",   "name": "시세 타일"},
        {"value": "table",   "name": "셀 종류를 고르는 표"},
        {"value": "candles", "name": "캔들 차트"},
        {"value": "treemap", "name": "트리맵"},
        {"value": "list",    "name": "한 줄 목록"},
    ],
    # 필드가 뷰에서 맡는 자리 (user_widget_fields.field_role)
    "SPEC_FIELD_ROLE": [
        {"value": "COLUMN",      "name": "표 컬럼"},
        {"value": "SYMBOL",      "name": "심볼"},
        {"value": "LABEL",       "name": "이름"},
        {"value": "TIME",        "name": "시각"},
        {"value": "TITLE",       "name": "제목"},
        {"value": "SUB",         "name": "제목 뒤 설명"},
        {"value": "HREF",        "name": "링크 주소"},
        {"value": "TAG",         "name": "꼬리표"},
        {"value": "VALUE",       "name": "값"},
        {"value": "VALUE_MUTED", "name": "값을 흐리게 (참이면)"},
        {"value": "DOT",         "name": "강조 점 (참이면)"},
        {"value": "CHANGE",      "name": "등락률"},
        {"value": "GROUP",       "name": "묶음"},
        {"value": "LINK",        "name": "누르면 갈 종목"},
    ],
    # 표 셀 종류 (user_widget_fields.format) — COLUMN 이 아닌 자리는 text
    "CELL_TYPE": [
        {"value": "text",    "name": "그대로"},
        {"value": "rank",    "name": "순위"},
        {"value": "stock",   "name": "종목 (로고 + 이름)"},
        {"value": "price",   "name": "가격"},
        {"value": "change",  "name": "등락률"},
        {"value": "compact", "name": "큰 수 (K·M·B)"},
        {"value": "number",  "name": "숫자"},
        {"value": "trend",   "name": "추세선"},
        {"value": "tag",     "name": "꼬리표"},
    ],
    # 행을 다듬는 함수 (user_widgets.transform) — 구현은 프론트 registry/builtinWidgets.js
    "TRANSFORM": [
        {"value": "events_by_time",  "name": "일정을 시각 순으로 + 실제/예상 값"},
        {"value": "rank_sort",       "name": "거래대금 다시 계산 + 정렬 기준대로 정렬"},
        {"value": "bars_window",     "name": "보여 줄 봉만 남기기 + 전일 종가"},
        {"value": "flatten_sectors", "name": "섹터 → 시가총액 상위 종목으로 펴기"},
        {"value": "news_rows",       "name": "기사 시각 표기 + 첫 티커"},
    ],
    # 탭에서 행을 거르는 함수 (user_widget_tabs.filter)
    "TAB_FILTER": [
        {"value": "watchlist_tickers", "name": "내 관심 종목이 들어 있는 행만"},
    ],
}

# 화면 변수 — bind_type=VAR 가 가리킬 수 있는 이름. 값은 화면이 채운다.
#   symbol  페이지에서 고른 종목 (위젯 헤더에서 따로 바꿀 수도 있다)
#   period  위젯 헤더의 기간 선택. 게이트웨이가 start_date/end_date 로 바꿔 준다
VARIABLES: List[Dict[str, str]] = [
    {"name": "symbol", "label": "종목 (페이지에서 고른 티커)"},
    {"name": "period", "label": "기간 (위젯 헤더의 기간 선택)"},
]

ALL_SCREENS = "*"

_VALID = {group: {c["value"] for c in codes} for group, codes in CODES.items()}
_VALID_VARS = {v["name"] for v in VARIABLES}
_KIND_OF = {c["value"]: c["kind"] for c in CODES["RENDERER"]}
_CODE_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_-]{0,29}$")
_WIDGET_TYPE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_\-]{0,99}$")


class UserWidgetError(ValueError):
    """정의가 잘못됨 — 라우트가 400 으로 돌려준다."""


class WidgetTypeInUse(UserWidgetError):
    """쓰는 위젯이 있어 지울 수 없음 — 라우트가 409 로 돌려준다."""


# ── 위젯 종류 목록 (widget_types) ─────────────────────────────────────────────

class WidgetTypeService:
    """③단계 '보여 줄 위젯' 의 목록. 읽기는 모든 사용자, 쓰기는 관리자(routes/admin.py)."""

    @staticmethod
    def list(db: Session) -> List[WidgetType]:
        rows = db.query(WidgetType).order_by(WidgetType.sort_seq.asc(), WidgetType.type_code.asc()).all()
        if rows:
            return rows
        # 처음 한 번 — 그리는 방식마다 같은 이름의 종류를 하나씩 넣는다.
        # (create_all 로 만든 DB 든 alembic 으로 만든 DB 든 같은 결과가 되도록 여기서 넣는다)
        rows = [
            WidgetType(type_code=c["value"], name=c["name"], renderer=c["value"], use_yn="Y", sort_seq=i * 10)
            for i, c in enumerate(CODES["RENDERER"])
        ]
        db.add_all(rows)
        db.commit()
        return rows

    @staticmethod
    def to_code(t: WidgetType) -> dict:
        return {
            "value": t.type_code,
            "name": t.name,
            "renderer": t.renderer,
            "kind": _KIND_OF.get(t.renderer, "table"),
            "use_yn": t.use_yn,
            "sort_seq": t.sort_seq,
        }

    @staticmethod
    def create(db: Session, data: dict) -> WidgetType:
        code = (data.get("type_code") or "").strip()
        if not _CODE_RE.match(code):
            raise UserWidgetError("코드는 영문자로 시작하는 영문·숫자·_·- 30자 이내여야 합니다")
        existing = {t.type_code: t for t in WidgetTypeService.list(db)}
        if code in existing:
            raise UserWidgetError(f"위젯 종류 '{code}' 은(는) 이미 있습니다")
        if data.get("renderer") not in _VALID["RENDERER"]:
            raise UserWidgetError(f"'{data.get('renderer')}' 은(는) RENDERER 코드가 아닙니다")
        name = (data.get("name") or "").strip()
        if not name:
            raise UserWidgetError("이름이 비어 있습니다")
        t = WidgetType(
            type_code=code, name=name, renderer=data["renderer"],
            use_yn="N" if data.get("use_yn") == "N" else "Y",
            sort_seq=int(data["sort_seq"]) if data.get("sort_seq") is not None
            else max((x.sort_seq for x in existing.values()), default=0) + 10,
        )
        db.add(t)
        db.commit()
        db.refresh(t)
        return t

    @staticmethod
    def update(db: Session, code: str, data: dict) -> Optional[WidgetType]:
        t = db.query(WidgetType).filter(WidgetType.type_code == code).first()
        if not t:
            return None
        if data.get("name") is not None:
            name = data["name"].strip()
            if not name:
                raise UserWidgetError("이름이 비어 있습니다")
            t.name = name
        if data.get("renderer") is not None:
            if data["renderer"] not in _VALID["RENDERER"]:
                raise UserWidgetError(f"'{data['renderer']}' 은(는) RENDERER 코드가 아닙니다")
            t.renderer = data["renderer"]
        if data.get("use_yn") in ("Y", "N"):
            t.use_yn = data["use_yn"]
        if data.get("sort_seq") is not None:
            t.sort_seq = int(data["sort_seq"])
        db.commit()
        db.refresh(t)
        return t

    @staticmethod
    def delete(db: Session, code: str) -> bool:
        t = db.query(WidgetType).filter(WidgetType.type_code == code).first()
        if not t:
            return False
        used = db.query(UserWidget).filter(UserWidget.view_type == code).count()
        if used:
            # 지우면 그 위젯들이 그려지지 않는다. 숨기려면 use_yn=N 으로.
            raise WidgetTypeInUse(f"이 종류를 쓰는 위젯이 {used}개 있어 지울 수 없습니다 (사용 안 함으로 바꾸세요)")
        db.delete(t)
        db.commit()
        return True


def get_codes(db: Session) -> dict:
    """설정 화면이 쓰는 모든 선택지 — 고정 코드 + 위젯 종류(DB) + 화면 변수."""
    codes = dict(CODES)
    codes["VIEW_TYPE"] = [WidgetTypeService.to_code(t) for t in WidgetTypeService.list(db)]
    return {"codes": codes, "variables": VARIABLES}


def serialize(db: Session, widgets: List[UserWidget]) -> List[dict]:
    """정의 + 그리는 방식(renderer). 종류가 지워졌으면 표로 그린다."""
    renderer = {t.type_code: t.renderer for t in WidgetTypeService.list(db)}
    return [{**w.to_dict(), "renderer": renderer.get(w.view_type, "table")} for w in widgets]


# ── 사용자 정의 위젯 ──────────────────────────────────────────────────────────

def _api_exists(provider: str, model: str) -> bool:
    import data_fetcher.providers_init  # noqa: F401 — 등록 보장 (이미 됐으면 no-op)
    from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry

    prov = ProviderRegistry.get_all().get(provider)
    return bool(prov and model in prov.fetcher_dict)


def _check(group: str, value: str, what: str) -> None:
    if value not in _VALID[group]:
        raise UserWidgetError(f"{what}: '{value}' 은(는) {group} 코드가 아닙니다")


def _validate(db: Session, provider: str, model: str, view_type: str,
              params: List[dict], fields: List[dict]) -> None:
    if not _api_exists(provider, model):
        raise UserWidgetError(f"API '{provider}/{model}' 을(를) 찾을 수 없습니다")
    types = {t.type_code: t for t in WidgetTypeService.list(db)}
    if view_type not in types:
        raise UserWidgetError(f"view_type: '{view_type}' 은(는) VIEW_TYPE(위젯 종류)에 없습니다")

    seen = set()
    for p in params:
        name = (p.get("param_name") or "").strip()
        if not name:
            raise UserWidgetError("파라미터 이름이 비어 있습니다")
        if name in seen:
            raise UserWidgetError(f"파라미터 '{name}' 이(가) 두 번 들어 있습니다")
        seen.add(name)
        _check("BIND_TYPE", p.get("bind_type", ""), f"파라미터 '{name}'")
        if p["bind_type"] == "VAR" and p.get("var_name") not in _VALID_VARS:
            raise UserWidgetError(f"파라미터 '{name}': 화면 변수 '{p.get('var_name')}' 은(는) 없습니다")
        if p["bind_type"] == "FIXED" and p.get("param_value") in (None, ""):
            raise UserWidgetError(f"파라미터 '{name}': 고정값이 비어 있습니다")

    seen = set()
    for f in fields:
        name = (f.get("field_name") or "").strip()
        if not name:
            raise UserWidgetError("필드 이름이 비어 있습니다")
        if name in seen:
            raise UserWidgetError(f"필드 '{name}' 이(가) 두 번 들어 있습니다")
        seen.add(name)
        _check("FIELD_ROLE", f.get("field_role", "COLUMN"), f"필드 '{name}'")
        _check("FIELD_FORMAT", f.get("format", "auto"), f"필드 '{name}'")

    if _KIND_OF.get(types[view_type].renderer) == "chart" and fields:
        roles = [f.get("field_role", "COLUMN") for f in fields]
        if roles.count("X") > 1:
            raise UserWidgetError("차트 가로축(X)은 하나만 고를 수 있습니다")
        # X·Y 를 둘 다 비우면 자동 감지에 맡긴다. 한쪽만 고른 건 실수다.
        if ("X" in roles) != ("Y" in roles):
            raise UserWidgetError("차트는 가로축(X)과 값(Y)을 함께 골라야 합니다")


def _clean_screens(screens: List[str]) -> List[str]:
    uniq = sorted({s.strip() for s in screens if s and s.strip()})
    # '*' 가 있으면 나머지는 뜻이 없다
    return [ALL_SCREENS] if ALL_SCREENS in uniq else uniq


def _set_children(w: UserWidget, params: Optional[List[dict]],
                  fields: Optional[List[dict]], screens: Optional[List[str]]) -> None:
    """자식 행을 통째로 바꾼다 (None 이면 그대로 둔다). 순서 = 받은 순서."""
    if params is not None:
        w.params = [
            UserWidgetParam(
                param_seq=i,
                param_name=p["param_name"].strip(),
                bind_type=p["bind_type"],
                param_value=None if p.get("param_value") is None else str(p["param_value"]),
                var_name=p.get("var_name") if p["bind_type"] == "VAR" else None,
            )
            for i, p in enumerate(params)
        ]
    if fields is not None:
        w.fields = [
            UserWidgetField(
                field_seq=i,
                field_name=f["field_name"].strip(),
                field_role=f.get("field_role", "COLUMN"),
                label=(f.get("label") or "").strip() or None,
                format=f.get("format", "auto"),
            )
            for i, f in enumerate(fields)
        ]
    if screens is not None:
        w.screens = [UserWidgetScreen(screen=s) for s in _clean_screens(screens)]


class UserWidgetService:

    @staticmethod
    def list(db: Session, user_id: str, screen: Optional[str] = None) -> List[UserWidget]:
        """내 위젯. screen 을 주면 그 화면에 내놓은(use_yn=Y) 것만."""
        rows = (
            db.query(UserWidget)
            .filter(UserWidget.user_id == user_id)
            .order_by(UserWidget.sort_seq.asc(), UserWidget.created_at.asc())
            .all()
        )
        if screen is None:
            return rows
        return [
            w for w in rows
            if w.use_yn == "Y" and any(s.screen in (screen, ALL_SCREENS) for s in w.screens)
        ]

    @staticmethod
    def get(db: Session, user_id: str, widget_id: str) -> Optional[UserWidget]:
        return (
            db.query(UserWidget)
            .filter(UserWidget.widget_id == widget_id, UserWidget.user_id == user_id)
            .first()
        )

    @staticmethod
    def create(db: Session, user_id: str, data: dict) -> UserWidget:
        params = data.get("params") or []
        fields = data.get("fields") or []
        _validate(db, data["provider"], data["model"], data.get("view_type", "table"), params, fields)

        w = UserWidget(
            widget_id=f"uw_{uuid.uuid4().hex[:12]}",
            user_id=user_id,
            name=data["name"].strip(),
            description=(data.get("description") or "").strip() or None,
            group_name=(data.get("group_name") or "").strip() or None,
            provider=data["provider"],
            model=data["model"],
            view_type=data.get("view_type", "table"),
            use_yn="N" if data.get("use_yn") == "N" else "Y",
            sort_seq=int(data.get("sort_seq") or 0),
        )
        _set_children(w, params, fields, data.get("screens") or [ALL_SCREENS])
        db.add(w)
        db.commit()
        db.refresh(w)
        return w

    @staticmethod
    def update(db: Session, user_id: str, widget_id: str, data: dict) -> Optional[UserWidget]:
        """부분 수정 — 안 보낸 항목은 그대로 둔다 (use_yn 만 바꾸는 토글도 이걸 쓴다)."""
        w = UserWidgetService.get(db, user_id, widget_id)
        if not w:
            return None

        provider = data.get("provider", w.provider)
        model = data.get("model", w.model)
        view_type = data.get("view_type", w.view_type)
        params = data.get("params")
        fields = data.get("fields")
        _validate(
            db, provider, model, view_type,
            params if params is not None else [p.to_dict() for p in w.params],
            fields if fields is not None else [f.to_dict() for f in w.fields],
        )

        w.provider, w.model, w.view_type = provider, model, view_type
        if "name" in data and data["name"]:
            w.name = data["name"].strip()
        if "description" in data:
            w.description = (data["description"] or "").strip() or None
        if "group_name" in data:
            w.group_name = (data["group_name"] or "").strip() or None
        if data.get("use_yn") in ("Y", "N"):
            w.use_yn = data["use_yn"]
        if data.get("sort_seq") is not None:
            w.sort_seq = int(data["sort_seq"])

        # 복합 PK(widget_id, seq)라 같은 키로 새 행을 넣기 전에 옛 행을 먼저 지운다
        if params is not None:
            w.params = []
        if fields is not None:
            w.fields = []
        if data.get("screens") is not None:
            w.screens = []
        db.flush()
        _set_children(w, params, fields, data.get("screens"))

        db.commit()
        db.refresh(w)
        return w

    @staticmethod
    def delete(db: Session, user_id: str, widget_id: str) -> bool:
        w = UserWidgetService.get(db, user_id, widget_id)
        if not w:
            return False
        db.delete(w)
        db.commit()
        return True


# ── 기본 제공 위젯의 사용자별 설정 ────────────────────────────────────────────

class WidgetPrefService:
    """코드에 정의된 위젯(프론트 레지스트리)을 사용자가 켜고 끄고, 내놓을 화면을 고른다.

    기본값(사용함 + 코드의 기본 배치)과 같은 위젯은 행을 두지 않는다 — 목록에 없는 위젯은 기본값이다.
    위젯 정의는 프론트에 있어 서버는 id 가 실제로 있는지 모른다. 형식만 확인한다.
    """

    @staticmethod
    def list(db: Session, user_id: str) -> List[dict]:
        screens: Dict[str, List[str]] = {}
        for s in db.query(UserWidgetPrefScreen).filter(UserWidgetPrefScreen.user_id == user_id):
            screens.setdefault(s.widget_type, []).append(s.screen)
        use = {p.widget_type: p.use_yn
               for p in db.query(UserWidgetPref).filter(UserWidgetPref.user_id == user_id)}
        return [
            {"widget_type": t, "use_yn": use.get(t, "Y"), "screens": sorted(screens.get(t, []))}
            for t in sorted(set(use) | set(screens))
        ]

    @staticmethod
    def set(db: Session, user_id: str, widget_type: str,
            use_yn: Optional[str] = None, screens: Optional[List[str]] = None) -> dict:
        if not _WIDGET_TYPE_RE.match(widget_type or ""):
            raise UserWidgetError(f"위젯 id '{widget_type}' 형식이 잘못됐습니다")
        if use_yn is not None and use_yn not in ("Y", "N"):
            raise UserWidgetError("use_yn 은 Y 또는 N 입니다")

        if use_yn is not None:
            pref = (
                db.query(UserWidgetPref)
                .filter(UserWidgetPref.user_id == user_id, UserWidgetPref.widget_type == widget_type)
                .first()
            )
            if use_yn == "Y":
                if pref:
                    db.delete(pref)      # 기본값으로 돌아가면 행을 지운다
            elif pref:
                pref.use_yn = "N"
            else:
                db.add(UserWidgetPref(user_id=user_id, widget_type=widget_type, use_yn="N"))

        if screens is not None:
            db.query(UserWidgetPrefScreen).filter(
                UserWidgetPrefScreen.user_id == user_id,
                UserWidgetPrefScreen.widget_type == widget_type,
            ).delete()
            # '*'(모든 화면) = 화면을 제한하지 않음 = 행 없음
            for s in _clean_screens(screens):
                if s != ALL_SCREENS:
                    db.add(UserWidgetPrefScreen(user_id=user_id, widget_type=widget_type, screen=s))

        db.commit()
        current = next((p for p in WidgetPrefService.list(db, user_id) if p["widget_type"] == widget_type), None)
        return current or {"widget_type": widget_type, "use_yn": "Y", "screens": []}


# ── 기본 제공 위젯의 정의 (user_id NULL) ─────────────────────────────────────

def _seed_builtin(db: Session) -> None:
    """시드(services/builtin_widget_seed.py)를 행으로 넣는다. 코드값이 틀리면 넣지 않고 알린다."""
    from app.backend.services.builtin_widget_seed import BUILTIN_WIDGETS, DEFAULT_GROUP

    for seq, d in enumerate(BUILTIN_WIDGETS):
        wid = d["widget_id"]
        _check("SPEC_VIEW", d["view_type"], f"기본 위젯 '{wid}'")
        if d.get("transform"):
            _check("TRANSFORM", d["transform"], f"기본 위젯 '{wid}'")
        if not d.get("source"):
            raise UserWidgetError(f"기본 위젯 '{wid}': 출처(source)가 비어 있습니다")
        w, h, min_w, min_h = d["size"]
        widget = UserWidget(
            widget_id=wid, user_id=None, name=d["name"], description=d.get("description"),
            group_name=d.get("group_name", DEFAULT_GROUP), view_type=d["view_type"],
            use_yn="Y", sort_seq=seq * 10,
            title=d.get("title"), endpoint=d.get("endpoint"), data_path=d.get("data_path"),
            source=d["source"], source_note=d.get("source_note"), transform=d.get("transform"),
            quote_key=d.get("quote_key"), refresh_sec=d.get("refresh_sec"),
            live_yn=d.get("live_yn", "N"), default_symbol=d.get("default_symbol"),
            empty_text=d.get("empty_text"), size_w=w, size_h=h, min_w=min_w, min_h=min_h,
        )
        widget.params = [
            UserWidgetParam(
                param_seq=i, param_name=name, bind_type="INPUT", param_value=default, label=label,
                options=[
                    UserWidgetParamOption(widget_id=wid, option_seq=j, option_value=v, label=lb, option_params=extra)
                    for j, (v, lb, extra) in enumerate(options)
                ],
            )
            for i, (name, label, default, options) in enumerate(d.get("params", []))
        ]
        for i, f in enumerate(d.get("fields", [])):
            _check("SPEC_FIELD_ROLE", f["field_role"], f"기본 위젯 '{wid}' 필드 '{f['field_name']}'")
            _check("CELL_TYPE", f["format"], f"기본 위젯 '{wid}' 필드 '{f['field_name']}'")
            widget.fields.append(UserWidgetField(field_seq=i, **f))
        for i, (code, label, flt, empty, items) in enumerate(d.get("tabs", [])):
            if flt:
                _check("TAB_FILTER", flt, f"기본 위젯 '{wid}' 탭 '{code}'")
            widget.tabs.append(UserWidgetTab(
                tab_seq=i, tab_code=code, label=label, filter=flt, empty_text=empty,
                items=[
                    UserWidgetTabItem(widget_id=wid, item_seq=j, symbol=sym, name=nm)
                    for j, (sym, nm) in enumerate(items)
                ],
            ))
        widget.options = [
            UserWidgetOption(opt_name=k, opt_value=str(v)) for k, v in d.get("options", {}).items()
        ]
        widget.screens = [
            UserWidgetScreen(screen=screen, tab=tab, pos_x=x, pos_y=y, pos_w=pw, pos_h=ph)
            for screen, tab, x, y, pw, ph in d.get("screens", [])
        ]
        db.add(widget)
    db.commit()


def _builtin_dict(w: UserWidget) -> dict:
    """화면(프론트 registry/builtinWidgets.js)이 받는 모양."""
    return {
        "widget_id": w.widget_id,
        "name": w.name,
        "description": w.description,
        "group_name": w.group_name,
        "title": w.title,
        "view_type": w.view_type,
        "endpoint": w.endpoint,
        "data_path": w.data_path,
        "source": [s.strip() for s in (w.source or "").split(",") if s.strip()],
        "source_note": w.source_note,
        "transform": w.transform,
        "quote_key": w.quote_key,
        "refresh_sec": w.refresh_sec,
        "live_yn": w.live_yn,
        "default_symbol": w.default_symbol,
        "empty_text": w.empty_text,
        "sort_seq": w.sort_seq,
        "size": {"w": w.size_w, "h": w.size_h, "minW": w.min_w, "minH": w.min_h},
        "params": [
            {
                "param_name": p.param_name,
                "label": p.label,
                "param_value": p.param_value,
                "options": [
                    {"value": o.option_value, "label": o.label,
                     "params": dict(parse_qsl(o.option_params or "", keep_blank_values=True))}
                    for o in p.options
                ],
            }
            for p in w.params
        ],
        "fields": [
            {"field_name": f.field_name, "field_role": f.field_role, "label": f.label, "format": f.format,
             "width": f.width, "sub_field": f.sub_field, "quote_field": f.quote_field}
            for f in w.fields
        ],
        "tabs": [
            {"tab_code": t.tab_code, "label": t.label, "filter": t.filter, "empty_text": t.empty_text,
             "items": [{"symbol": i.symbol, "name": i.name} for i in t.items]}
            for t in w.tabs
        ],
        "options": {o.opt_name: o.opt_value for o in w.options},
        "screens": sorted(
            ({"screen": s.screen, "tab": s.tab, "x": s.pos_x, "y": s.pos_y, "w": s.pos_w, "h": s.pos_h}
             for s in w.screens),
            key=lambda s: s["screen"],
        ),
        "updated_at": w.updated_at.isoformat() if w.updated_at else None,
    }


class BuiltinWidgetService:
    """기본 제공 위젯 — 모든 사용자가 같이 보는 정의. 행은 user_widgets 계열 테이블에 있다."""

    @staticmethod
    def _rows(db: Session) -> List[UserWidget]:
        return (
            db.query(UserWidget)
            .filter(UserWidget.user_id.is_(None))
            .order_by(UserWidget.sort_seq.asc(), UserWidget.widget_id.asc())
            .all()
        )

    @staticmethod
    def list(db: Session) -> List[dict]:
        """사용 중(use_yn=Y)인 기본 제공 위젯. 하나도 없으면(새 DB) 시드를 먼저 넣는다."""
        rows = BuiltinWidgetService._rows(db)
        if not rows:
            _seed_builtin(db)
            rows = BuiltinWidgetService._rows(db)
        return [_builtin_dict(w) for w in rows if w.use_yn == "Y"]
