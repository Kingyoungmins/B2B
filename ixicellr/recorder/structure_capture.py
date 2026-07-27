"""행/열 삽입 같은 구조 변경의 캡처.

두 경로가 있다:
  1) **자동(버튼 불필요)** — SheetChange 이벤트로 잡는다(`classify_band_change`).
     실측: 행/열을 삽입·삭제·지우기 하면 모두 SheetChange 가 전체 밴드(`$C:$D`,
     `$2:$2`)로 발화한다. 삽입과 '전체열 내용지우기'는 Target 이 동일($B:$B)해
     구분이 안 되는데, **UsedRange 차원 델타**로 가른다(삽입 +N / 삭제 −N / 지우기 0).
     셀이 아니라 메타만 읽어 저사양에서도 저렴하다(Docs/09).
  2) 수동(fallback) — 선택 영역 기준 명시 캡처(`capture_*`). 자동이 못 잡는
     경계(데이터 밖 삽입 등)나 사용자가 명시하고 싶을 때 쓴다.
"""
from __future__ import annotations

from ..model import a1
from ..model.action_ir import DELETE_COLS, DELETE_ROWS, INSERT_COLS, INSERT_ROWS, Action, Target


def classify_band_change(*, is_full_cols, is_full_rows,
                         d_first_col, d_last_col, d_first_row, d_last_row):
    """전체 행/열 밴드 SheetChange 를 구조 액션 종류로 분류. **COM 무관 순수 함수**.

    삽입/삭제/지우기는 모두 전체 밴드(`$C:$D`/`$2:$2`)로 같은 SheetChange 를 내므로
    UsedRange **경계상자**의 변화로 가른다(단순 개수 델타로는 '가장자리 열 지우기'가
    삭제처럼 보여 오분류된다 — 실측 확인).

    - is_full_cols/is_full_rows: Target 이 전체 열/행 밴드인지.
    - d_first_col/d_last_col: 이벤트 직전 대비 UsedRange 좌/우 경계열의 변화.
    - d_first_row/d_last_row: 상/하 경계행의 변화.

    열 기준 판정(행도 대칭):
      - 우측 경계 증가 → INSERT_COLS (데이터가 오른쪽으로 밀림)
      - 우측 경계 감소 **AND** 좌측 경계 불변 → DELETE_COLS (데이터가 왼쪽으로 시프트)
      - 그 외(좌측 경계가 우로 이동 = 왼쪽 가장자리 내용 지우기, 또는 무변화) → None

    반환: INSERT_COLS/DELETE_COLS/INSERT_ROWS/DELETE_ROWS 또는 None(구조 아님/모호).
    """
    if bool(is_full_cols) == bool(is_full_rows):  # 둘 다거나 둘 다 아님 → 모호
        return None
    if is_full_cols:
        if d_last_col > 0:
            return INSERT_COLS
        if d_last_col < 0 and d_first_col == 0:
            return DELETE_COLS
        return None
    if d_last_row > 0:
        return INSERT_ROWS
    if d_last_row < 0 and d_first_row == 0:
        return DELETE_ROWS
    return None


def build_insert_cols_action(seq: int, book: str, sheet: str, first_col, count: int) -> Action:
    col = a1.num_to_col(int(first_col)) if isinstance(first_col, int) else str(first_col)
    return Action(seq, INSERT_COLS, Target(book, sheet, col),
                  payload={"index": col, "count": int(count)},
                  evidence={"capture": "insert_cols"})


def build_insert_rows_action(seq: int, book: str, sheet: str, first_row, count: int) -> Action:
    row = int(first_row)
    return Action(seq, INSERT_ROWS, Target(book, sheet, str(row)),
                  payload={"index": row, "count": int(count)},
                  evidence={"capture": "insert_rows"})


def build_delete_cols_action(seq: int, book: str, sheet: str, first_col, count: int) -> Action:
    col = a1.num_to_col(int(first_col)) if isinstance(first_col, int) else str(first_col)
    return Action(seq, DELETE_COLS, Target(book, sheet, col),
                  payload={"index": col, "count": int(count)},
                  evidence={"capture": "delete_cols"})


def build_delete_rows_action(seq: int, book: str, sheet: str, first_row, count: int) -> Action:
    row = int(first_row)
    return Action(seq, DELETE_ROWS, Target(book, sheet, str(row)),
                  payload={"index": row, "count": int(count)},
                  evidence={"capture": "delete_rows"})


def capture_insert_cols(app, sink, registry):
    """현재 선택 영역의 열 개수만큼, 첫 열 앞에 삽입하는 단계로 캡처."""
    try:
        sel = app.Selection
        book = registry.register(app.ActiveWorkbook)
        sheet = app.ActiveSheet.Name
        first_col = int(sel.Column)
        count = int(sel.Columns.Count)
    except Exception as e:
        return None, f"열 삽입 캡처 실패: {e}"
    a = build_insert_cols_action(sink._seq + 1, book, sheet, first_col, count)
    sink.actions.append(a)
    sink._seq += 1
    return a, ""


def capture_insert_rows(app, sink, registry):
    """현재 선택 영역의 행 개수만큼, 첫 행 위에 삽입하는 단계로 캡처."""
    try:
        sel = app.Selection
        book = registry.register(app.ActiveWorkbook)
        sheet = app.ActiveSheet.Name
        first_row = int(sel.Row)
        count = int(sel.Rows.Count)
    except Exception as e:
        return None, f"행 삽입 캡처 실패: {e}"
    a = build_insert_rows_action(sink._seq + 1, book, sheet, first_row, count)
    sink.actions.append(a)
    sink._seq += 1
    return a, ""


def capture_delete_cols(app, sink, registry):
    """현재 선택 영역의 열 개수만큼, 첫 열부터 삭제하는 단계로 캡처."""
    try:
        sel = app.Selection
        book = registry.register(app.ActiveWorkbook)
        sheet = app.ActiveSheet.Name
        first_col = int(sel.Column)
        count = int(sel.Columns.Count)
    except Exception as e:
        return None, f"열 삭제 캡처 실패: {e}"
    a = build_delete_cols_action(sink._seq + 1, book, sheet, first_col, count)
    sink.actions.append(a)
    sink._seq += 1
    return a, ""


def capture_delete_rows(app, sink, registry):
    """현재 선택 영역의 행 개수만큼, 첫 행부터 삭제하는 단계로 캡처."""
    try:
        sel = app.Selection
        book = registry.register(app.ActiveWorkbook)
        sheet = app.ActiveSheet.Name
        first_row = int(sel.Row)
        count = int(sel.Rows.Count)
    except Exception as e:
        return None, f"행 삭제 캡처 실패: {e}"
    a = build_delete_rows_action(sink._seq + 1, book, sheet, first_row, count)
    sink.actions.append(a)
    sink._seq += 1
    return a, ""
