"""저사양 기본 상수 (Docs/01 §1.6, Docs/09 §9.6). 환경변수로 조정.

현장에서 더 조여야 하면 IXICELLR_* 환경변수로 덮어쓴다.
"""
from __future__ import annotations

import os


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


# --- 레코딩 (Docs/09) ---
PUMP_SLEEP_MS = _int("IXICELLR_PUMP_SLEEP_MS", 50)               # 이벤트 펌프 슬립
COPY_POLL_THROTTLE_S = _float("IXICELLR_COPY_POLL_THROTTLE", 0.5)  # CutCopyMode 폴 throttle
HANDLER_BUDGET_MS = _int("IXICELLR_HANDLER_BUDGET_MS", 5)        # 핸들러 경고 임계
SNAPSHOT_DIFF_MAX_CELLS = _int("IXICELLR_SNAPSHOT_MAX_CELLS", 100_000)
#: 서식 자동 스냅샷(시작/정지) 시트당 셀 상한. 초과 시 자동 생략(🎨 버튼 사용).
#: 저사양 보호를 위해 낮게. 환경변수로 조정.
AUTO_FORMAT_MAX_CELLS = _int("IXICELLR_AUTO_FORMAT_MAX_CELLS", 2000)
#: 이 셀 수 이하의 입력/붙여넣기는 값을 즉시 캡처. 초과분만 deferred(정지 시 값 채움).
LARGE_TARGET_CELLS = _int("IXICELLR_LARGE_TARGET_CELLS", 100_000)
#: 복사(Ctrl+C) '시점'에 소스 값을 스냅샷할 최대 셀 수. 재현(reset 후)에 소스가 비어도
#: 이 스냅샷 값으로 결정적으로 붙여넣기 위함. 과대 선택(전체열 등)은 캡처 생략→paste_copied 폴백.
COPY_VALUE_MAX_CELLS = _int("IXICELLR_COPY_VALUE_MAX_CELLS", 50_000)
#: deferred 를 정지 시 값으로 채울 최대 셀 수. 이걸 넘으면 값을 안 채우고
#: 단계로만 남겨(스킬 창에서 보고 삭제 가능) 파일/메모리 폭주를 막는다.
DEFERRED_RESOLVE_MAX_CELLS = _int("IXICELLR_DEFERRED_RESOLVE_MAX", 200_000)
#: 증분 서식 캡처(녹화 중 중간중간) — _pump 틱 주기(약 50ms/틱 → 40≈2초)와
#: 한 번에 떠올 dirty 영역 셀 상한. 저사양에서 버벅이면 주기↑/상한↓ 로 조절.
FMT_FLUSH_INTERVAL_TICKS = _int("IXICELLR_FMT_FLUSH_TICKS", 40)
FMT_DIRTY_MAX_CELLS = _int("IXICELLR_FMT_DIRTY_MAX_CELLS", 4000)
# 열너비/행높이 자동 diff 상한. 열은 보통 적고 중요하므로 넉넉히, 행높이는 과대
# 스냅샷 방지를 위해 제한한다.
DIMENSION_MAX_COLS = _int("IXICELLR_DIMENSION_MAX_COLS", 512)
DIMENSION_MAX_ROWS = _int("IXICELLR_DIMENSION_MAX_ROWS", 5000)
# 행/열 그룹(개요) 자동 캡처 스캔 상한. OutlineLevel 을 행/열마다 1회씩 읽어(begin·stop)
# 비싸므로 보수적으로 둔다. 더 넓은 그룹은 자동 캡처 안 됨(저사양 보호). 0 이면 비활성.
OUTLINE_MAX_ROWS = _int("IXICELLR_OUTLINE_MAX_ROWS", 2000)
OUTLINE_MAX_COLS = _int("IXICELLR_OUTLINE_MAX_COLS", 256)
# 정지 diff 객체 캡처 모드.
# full: 기존처럼 begin/stop 에 모든 시트 객체 baseline 비교(커버리지 최대).
# dirty: begin 은 싼 메타 위주, stop 은 녹화 중 건드린 시트만 객체 deep diff(대용량 보호).
# off: 객체/속성 diff 비활성.
OBJECT_CAPTURE_MODE = os.environ.get("IXICELLR_OBJECT_CAPTURE_MODE", "dirty").strip().lower()
SHEET_SIGNATURE_MAX_CELLS = _int("IXICELLR_SHEET_SIGNATURE_MAX_CELLS", 2000)
# 데이터 유효성: SpecialCells 영역이 이 셀 수 이하면 셀별로 읽어 '인접한 서로 다른
# 규칙'을 분해(섞임 방지). 초과하면 대표(좌상단) 셀 1개로 폴백(저사양 보호 — 큰 영역은
# 보통 균일 규칙). 균일 영역은 어느 쪽이든 기존과 동일하게 영역 주소 1건만 남는다.
VALIDATION_SPLIT_MAX_CELLS = _int("IXICELLR_VALIDATION_SPLIT_MAX_CELLS", 256)
# 데이터 유효성 셀별 분해의 시트당 누적 셀 예산. 작은 validation area 가 수백/수천 개
# 흩어져 있으면 영역별 상한만으로는 begin/stop 이 길어질 수 있어 전체 예산으로 한 번 더
# 잠근다. 예산 초과분은 대표셀+영역 주소로 폴백(속도 보호, 대형/대량 영역 best-effort).
VALIDATION_SPLIT_MAX_TOTAL_CELLS = _int("IXICELLR_VALIDATION_SPLIT_MAX_TOTAL_CELLS", 1024)

# --- 리플레이 (Docs/01 §1.6) ---
PY_COM_BUDGET = _int("IXICELLR_COM_BUDGET", 400)                 # 스텝당 COM 호출 상한
PY_SKILL_TIMEOUT_S = _int("IXICELLR_SKILL_TIMEOUT", 75)          # 스킬 실행 제한
PY_READ_MAX_CELLS = _int("IXICELLR_READ_MAX_CELLS", 6_000_000)   # 벌크 read 상한

# --- 위생 (Docs/01 §1.6) ---
IDLE_EXCEL_TTL_S = _int("IXICELLR_IDLE_TTL", 900)               # 숨김 Excel 유휴 종료
HOUSEKEEPING_INTERVAL_S = _int("IXICELLR_HOUSEKEEPING_INTERVAL", 600)
EXCEL_REAP_INTERVAL_S = _int("IXICELLR_REAP_INTERVAL", 300)
