"""사용자별 provider API 키 저장/조회 — 백엔드 DB(암호화).

key-only provider(FRED/FMP/Polygon/AlphaVantage/KIS)는 서버에서 이 키로 호출한다.
값은 Fernet 암호화된 JSON으로 저장한다. 단일 키는 {"api_key": "..."},
다중 필드는 {"appkey": "...", "appsecret": "..."} 형태.

QueryExecutor의 credential resolver가 get_credentials(user_id, provider)를 사용해
요청 사용자의 키를 주입한다. 원문 키는 status()로는 절대 노출하지 않는다(마스킹).
"""
from __future__ import annotations

import json
import logging
from typing import Dict, List, Optional

from app.backend.core.db import get_db_sync
from app.backend.core.key_crypto import decrypt, encrypt
from index_analyzer.models.orm import UserApiKey

log = logging.getLogger(__name__)

# 단일 키 provider인지 여부에 따라 저장 형태가 달라진다.
_MULTI_FIELD = {"kis": ["appkey", "appsecret"]}


def _mask(v: str) -> str:
    return f"{v[:4]}…{v[-2:]}" if len(v) > 6 else "***"


def _load_value(row: UserApiKey) -> Dict[str, str]:
    return json.loads(decrypt(row.enc_value))


def get_credentials(user_id: str, provider: str) -> Optional[Dict[str, str]]:
    """요청 사용자의 provider 자격증명 dict 반환. 없으면 None."""
    if not user_id:
        return None
    db = get_db_sync()
    try:
        row = db.query(UserApiKey).filter(
            UserApiKey.user_id == user_id, UserApiKey.provider == provider.lower()
        ).first()
        if row is None:
            return None
        return _load_value(row)
    finally:
        db.close()


def set_key(
    user_id: str,
    provider: str,
    api_key: Optional[str] = None,
    fields: Optional[Dict[str, str]] = None,
) -> None:
    """단일 키 또는 다중 필드 저장(병합). 빈 값은 무시."""
    provider = provider.lower()
    if fields:
        value = {k: v.strip() for k, v in fields.items() if v and v.strip()}
    elif api_key and api_key.strip():
        value = {"api_key": api_key.strip()}
    else:
        raise ValueError("키 값이 비어 있습니다")
    if not value:
        raise ValueError("키 값이 비어 있습니다")

    db = get_db_sync()
    try:
        row = db.query(UserApiKey).filter(
            UserApiKey.user_id == user_id, UserApiKey.provider == provider
        ).first()
        if row is not None:
            # 기존 값과 병합(다중 필드 부분 갱신 허용)
            merged = _load_value(row)
            merged.update(value)
            row.enc_value = encrypt(json.dumps(merged))
        else:
            db.add(UserApiKey(
                user_id=user_id, provider=provider,
                enc_value=encrypt(json.dumps(value)),
            ))
        db.commit()
    finally:
        db.close()


def delete_key(user_id: str, provider: str) -> bool:
    provider = provider.lower()
    db = get_db_sync()
    try:
        row = db.query(UserApiKey).filter(
            UserApiKey.user_id == user_id, UserApiKey.provider == provider
        ).first()
        if row is None:
            return False
        db.delete(row)
        db.commit()
        return True
    finally:
        db.close()


def list_status(user_id: str) -> List[Dict[str, object]]:
    """사용자의 등록 provider별 마스킹 상태(원문 비노출)."""
    db = get_db_sync()
    try:
        rows = db.query(UserApiKey).filter(UserApiKey.user_id == user_id).all()
        out: List[Dict[str, object]] = []
        for row in rows:
            try:
                value = _load_value(row)
            except ValueError:
                continue
            fields = sorted(k for k, v in value.items() if v)
            masked_first = _mask(next((v for v in value.values() if v), ""))
            out.append({
                "provider": row.provider,
                "configured": bool(fields),
                "masked": masked_first,
                "fields": fields,
            })
        return out
    finally:
        db.close()
