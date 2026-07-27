"""ixi-Cell-R — Excel Action Record & Replay (저사양 폐쇄망 네이티브).

코어(record & replay)는 COM 의존부와 COM 무관부로 나뉜다:
  - COM 무관(여기서 단위 테스트 가능): model, distiller, parametrize, skillstore, runtime
  - COM 의존(Excel 있는 PC에서 동작): recorder, replay.ctx, replay.engine
"""

__version__ = "0.1.0-dev"
