"""리플레이 엔진 — ctx 기반 벌크 COM (Docs/05 §5.1). Excel 필요.

dispatch()(스텝 → ctx 동사 라우팅)는 COM 무관이라 가짜 ctx 로 테스트 가능하고,
replay()/ExcelComContext 만 실제 Excel 을 요구한다.
"""

from .engine import UnsupportedStep, dispatch  # noqa: F401
