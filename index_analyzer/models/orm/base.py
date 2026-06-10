"""
ORM Base — 추상 모델 레이어

모든 구현 ORM 모델(ingest/process/calc/recommend/user)이 상속하는 단일
declarative Base. 같은 Base.metadata 에 등록되어야 relationship 문자열 참조와
Base.metadata.create_all() 이 정상 동작한다.

명명 규칙(데이터 흐름 IN → PROC → CALC → RCMD):
- MBS_IN_{}   : 입수 (크롤러/수집기)
- MBS_PROC_{} : 가공 (ML/요약/티커추출)
- MBS_CALC_{} : 계산 (메트릭)
- MBS_RCMD_{} : 추천 (결과)
"""
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

__all__ = ["Base"]
