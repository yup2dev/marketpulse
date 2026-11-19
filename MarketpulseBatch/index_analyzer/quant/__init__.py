"""퀀트 산출물 — 팩터 → 예측 모델 → 시그널 융합.

    factors.py    일별 종가 → 월말 팩터 점수 (가격 기반, 그 달까지의 값만 쓴다)
    evaluate.py   팩터 성과 — IC · 롱숏 · 분위 수익률
    models.py     워크포워드 예측 모델(그래디언트 부스팅 · MLP · 로지스틱) + 융합(평균 · 스태킹)
    regime.py     시장 국면 — 가우시안 HMM (상태 3개)
    build.py      위를 묶어 화면이 그릴 행 목록으로 (dataset → rows · meta)
    panel.py      월별 패널(팩터 z · 표본 밖 확률 · 다음 달 수익률) — 서버가 웹의 전략을 바로 백테스트하는 재료

계산은 전부 로컬 배치에서 한다. 결과는 mbs_in_quant_snapshot · mbs_in_quant_panel 에 적재되고 서버는 읽기(+ 패널로 전략 계산)만 한다.
"""
from .build import build_all, build_snapshots, DATASETS

__all__ = ["build_all", "build_snapshots", "DATASETS"]
