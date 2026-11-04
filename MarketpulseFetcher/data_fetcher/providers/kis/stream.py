"""
한국투자증권(KIS) Open API — 실시간 체결가 WebSocket 스트림.

StreamFetcher 구현. Polygon(미국)과 동일 인터페이스로, ws.py의
stream_fetcher_loop 와 같은 패턴으로 붙여 쓸 수 있다.

────────────────────────────────────────────────────────────────────────────
인증 흐름
  1) REST POST /oauth2/Approval (appkey, secretkey) → approval_key 발급
  2) ws://ops.koreainvestment.com:21000 (실전) 연결
  3) 구독 JSON 전송:
       {"header":{"approval_key":KEY,"custtype":"P","tr_type":"1","content-type":"utf-8"},
        "body":{"input":{"tr_id":"H0STCNT0","tr_key":"005930"}}}
     tr_type "1"=등록, "2"=해제

수신 프레임
  · 실시간 체결: 텍스트 `0|H0STCNT0|001|<필드들>` — '|' 3개로 헤더, 본문은 '^' 구분
       flag '0'=평문, '1'=암호화(체결통보 등 — 여기선 건너뜀)
  · 제어 메시지: JSON
       - PINGPONG  → 받은 프레임 그대로 echo 해야 연결 유지
       - 구독 응답 → rt_cd/msg 확인 (SUBSCRIBE SUCCESS 등)

TR ID
  · 국내주식 실시간체결가:        H0STCNT0   tr_key = 6자리 종목코드 (예 "005930")
  · 해외주식 실시간지연체결가:    HDFSCNT0   tr_key = "D" + 거래소(3) + 심볼 (예 "DNASAAPL")
       거래소 코드: NAS(나스닥) NYS(뉴욕) AMS(아멕스)

⚠️ 제약: 한 approval_key(세션)당 실시간 등록은 약 41건. 화면에 보이는 행만
   구독하는 전제(랭킹 순서는 DB 스냅샷이 담당)로 설계할 것.

⚠️ TODO(라이브 검증 필요):
   - H0STCNT0 / HDFSCNT0 필드 인덱스는 KIS 최신 문서/실데이터로 재확인.
   - 다중 레코드(한 프레임에 count>1) 분할 파싱은 첫 레코드만 처리 중.
   - 해외 심볼→거래소 매핑(exchange_map)은 호출측(DB 유니버스)에서 주입.
────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, List, Optional

try:
    import websockets
    _HAS_WS = True
except ImportError:
    _HAS_WS = False

try:
    import httpx
    _HAS_HTTPX = True
except ImportError:
    _HAS_HTTPX = False

from data_fetcher.abstract_provider.abstract.stream import StreamFetcher, StreamFetcherError

log = logging.getLogger(__name__)

# 실전 / 모의
_REST_URL = {
    "real":  "https://openapi.koreainvestment.com:9443",
    "paper": "https://openapivts.koreainvestment.com:29443",
}
_WS_URL = {
    "real":  "ws://ops.koreainvestment.com:21000",
    "paper": "ws://ops.koreainvestment.com:31000",
}

TR_DOMESTIC = "H0STCNT0"   # 국내주식 실시간체결가
TR_OVERSEAS = "HDFSCNT0"   # 해외주식 실시간지연체결가

# 한 세션당 실시간 등록 한도 (KIS 정책)
MAX_SUBSCRIPTIONS = 41

# 전일대비부호: 1상한 2상승 3보합 4하한 5하락 → 음수 여부
_NEG_SIGNS = {"4", "5"}


class KISStreamFetcher(StreamFetcher):
    """KIS 실시간 체결가 스트림 (국내 H0STCNT0 / 해외 HDFSCNT0).

    Args:
        credentials: {"appkey": "...", "appsecret": "..."}
                     없으면 환경변수 KIS_APPKEY / KIS_APPSECRET 사용.
        env:         "real" | "paper" (기본 "real")
        exchange_map: 해외 심볼 → 거래소코드(NAS/NYS/AMS). 해외 구독 시 필요.
    """

    provider = "kis"
    reconnect_delay = 3.0
    max_reconnects = 0  # 무한 재연결

    def __init__(
        self,
        credentials: Optional[Dict[str, str]] = None,
        env: str = "real",
        exchange_map: Optional[Dict[str, str]] = None,
    ):
        super().__init__(credentials)
        if not _HAS_WS:
            raise ImportError("websockets package required: pip install websockets")
        if not _HAS_HTTPX:
            raise ImportError("httpx package required: pip install httpx")
        if env not in _WS_URL:
            raise StreamFetcherError(f"env must be 'real' or 'paper', got {env!r}")

        self._env = env
        self._ws = None
        self._approval_key: str = ""
        self._exchange_map = {k.upper(): v for k, v in (exchange_map or {}).items()}

        self._appkey = (credentials or {}).get("appkey") or os.getenv("KIS_APPKEY", "")
        self._appsecret = (credentials or {}).get("appsecret") or os.getenv("KIS_APPSECRET", "")
        if not self._appkey or not self._appsecret:
            raise StreamFetcherError(
                "KIS appkey/appsecret required (credentials or KIS_APPKEY/KIS_APPSECRET env)."
            )

        # tr_key → 표준심볼 역매핑 (수신 메시지의 코드 → 우리 심볼 복원용)
        self._key_to_symbol: Dict[str, str] = {}

    # ── 인증 ──────────────────────────────────────────────────────────────────

    async def _fetch_approval_key(self) -> str:
        """REST /oauth2/Approval 로 WebSocket 접속용 approval_key 발급."""
        url = f"{_REST_URL[self._env]}/oauth2/Approval"
        body = {
            "grant_type": "client_credentials",
            "appkey": self._appkey,
            "secretkey": self._appsecret,
        }
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=body)
            resp.raise_for_status()
            key = (resp.json() or {}).get("approval_key", "")
        if not key:
            raise StreamFetcherError("approval_key 발급 실패 (응답에 키 없음)")
        return key

    # ── StreamFetcher 구현 ────────────────────────────────────────────────────

    async def connect(self) -> None:
        self._approval_key = await self._fetch_approval_key()
        url = _WS_URL[self._env]
        log.info("[kis-stream] connecting to %s (%s)", url, self._env)
        # KIS는 app-level PINGPONG을 쓰므로 라이브러리 ping 비활성화
        self._ws = await websockets.connect(url, ping_interval=None, max_size=None)
        self._connected = True
        log.info("[kis-stream] connected")

    def _tr_for(self, symbol: str) -> Optional[tuple[str, str]]:
        """표준 심볼 → (tr_id, tr_key). 매핑 불가 시 None."""
        s = (symbol or "").upper().strip()
        if not s:
            return None
        # 국내: 6자리 숫자 (.KS/.KQ 접미사 제거)
        base = s.split(".")[0]
        if base.isdigit() and len(base) == 6:
            return TR_DOMESTIC, base
        # 해외: exchange_map 으로 거래소 결정 (없으면 NAS 기본)
        exch = self._exchange_map.get(s) or self._exchange_map.get(base) or "NAS"
        return TR_OVERSEAS, f"D{exch}{base}"

    async def _send_sub(self, tr_id: str, tr_key: str, subscribe: bool) -> None:
        msg = {
            "header": {
                "approval_key": self._approval_key,
                "custtype": "P",
                "tr_type": "1" if subscribe else "2",
                "content-type": "utf-8",
            },
            "body": {"input": {"tr_id": tr_id, "tr_key": tr_key}},
        }
        await self._ws.send(json.dumps(msg))

    async def subscribe(self, symbols: List[str]) -> None:
        if not symbols or not self._ws:
            return
        if len(self._key_to_symbol) >= MAX_SUBSCRIPTIONS:
            log.warning("[kis-stream] 구독 한도(%d) 도달 — 일부 무시", MAX_SUBSCRIPTIONS)
        for sym in symbols:
            if len(self._key_to_symbol) >= MAX_SUBSCRIPTIONS:
                break
            tr = self._tr_for(sym)
            if not tr:
                continue
            tr_id, tr_key = tr
            self._key_to_symbol[tr_key] = sym.upper()
            await self._send_sub(tr_id, tr_key, subscribe=True)
        log.info("[kis-stream] subscribed (%d active)", len(self._key_to_symbol))

    async def unsubscribe(self, symbols: List[str]) -> None:
        if not symbols or not self._ws:
            return
        for sym in symbols:
            tr = self._tr_for(sym)
            if not tr:
                continue
            tr_id, tr_key = tr
            self._key_to_symbol.pop(tr_key, None)
            await self._send_sub(tr_id, tr_key, subscribe=False)

    async def stream(self) -> AsyncIterator[Dict[str, Any]]:
        if not self._ws:
            raise StreamFetcherError("Not connected. Call connect() first.")
        async for raw in self._ws:
            if not isinstance(raw, str) or not raw:
                continue
            # 실시간 체결 프레임: '0|TR|cnt|...' / '1|...'(암호화)
            if raw[0] in ("0", "1") and "|" in raw:
                normalized = self.normalize(raw)
                if normalized:
                    yield normalized
                continue
            # 제어 메시지(JSON): PINGPONG / 구독 응답
            try:
                ctrl = json.loads(raw)
            except json.JSONDecodeError:
                continue
            tr_id = (ctrl.get("header") or {}).get("tr_id")
            if tr_id == "PINGPONG":
                # 받은 프레임 그대로 echo → 연결 유지
                await self._ws.send(raw)
                continue
            # 구독 성공/실패 응답 로깅
            body = ctrl.get("body") or {}
            if body.get("rt_cd") not in (None, "0"):
                log.warning("[kis-stream] subscribe response: %s", body.get("msg1"))

    async def close(self) -> None:
        self._connected = False
        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None
        log.info("[kis-stream] closed")

    # ── 정규화 ────────────────────────────────────────────────────────────────

    def normalize(self, raw: Any) -> Optional[Dict[str, Any]]:
        """KIS 실시간 체결 프레임 → 표준 quote dict.

        프레임: '{flag}|{tr_id}|{count}|{f0^f1^f2^...}'
        flag '1'(암호화)은 건너뜀(체결가는 평문 '0').
        """
        if not isinstance(raw, str):
            return None
        parts = raw.split("|", 3)
        if len(parts) < 4:
            return None
        flag, tr_id, _count, body = parts
        if flag != "0":
            return None  # 암호화 프레임(체결통보 등) — 시세 아님
        fields = body.split("^")

        try:
            if tr_id == TR_DOMESTIC:
                return self._normalize_domestic(fields)
            if tr_id == TR_OVERSEAS:
                return self._normalize_overseas(fields)
        except (IndexError, ValueError):
            return None
        return None

    def _normalize_domestic(self, f: List[str]) -> Optional[Dict[str, Any]]:
        # H0STCNT0: 0=종목코드 2=현재가 3=대비부호 4=전일대비 5=전일대비율 13=누적거래량
        code = f[0]
        price = float(f[2])
        sign = f[3]
        chg = float(f[4] or 0)
        pct = float(f[5] or 0)
        if sign in _NEG_SIGNS:
            chg, pct = -abs(chg), -abs(pct)
        vol = int(f[13] or 0)
        symbol = self._key_to_symbol.get(code, code)
        return {
            "symbol": symbol,
            "price": round(price, 4),
            "change": round(chg, 4),
            "change_percent": round(pct, 4),
            "volume": vol,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def _normalize_overseas(self, f: List[str]) -> Optional[Dict[str, Any]]:
        # HDFSCNT0: 1=종목코드(SYMB) 11=현재가(LAST) 12=대비부호 13=대비 14=등락율 20=누적거래량
        symb = f[1]
        price = float(f[11])
        sign = f[12]
        chg = float(f[13] or 0)
        pct = float(f[14] or 0)
        if sign in _NEG_SIGNS:
            chg, pct = -abs(chg), -abs(pct)
        vol = int(f[20] or 0)
        symbol = self._key_to_symbol.get(f"D{self._exchange_map.get(symb, 'NAS')}{symb}", symb)
        return {
            "symbol": symbol,
            "price": round(price, 4),
            "change": round(chg, 4),
            "change_percent": round(pct, 4),
            "volume": vol,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
