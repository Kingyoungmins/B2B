"""Action IR — 시간순 캡처 표현 (Docs/04 §4.3).

레코더는 이벤트를 '즉시 코드'로 굳히지 않고 Action 리스트로 적재한다.
distiller 의 입력이며, 재정제를 위해 .icr 번들의 recordings/ 에도 보관한다.
"""
from __future__ import annotations

from dataclasses import dataclass, field

# --- kind 상수 (Docs/04 §4.3.1) ---
CELL_EDIT = "cell_edit"
RANGE_FILL = "range_fill"
SORT = "sort"
FILTER = "filter"
COPY_PASTE = "copy_paste"
CLEAR = "clear"
FORMAT = "format"        # 색/글꼴/테두리/숫자서식/정렬 (이벤트 없음 → 스냅샷)
MERGE = "merge"
UNMERGE = "unmerge"
DIMENSION = "dimension"  # 열너비/행높이
INSERT_ROWS = "insert_rows"
INSERT_COLS = "insert_cols"
DELETE_ROWS = "delete_rows"
DELETE_COLS = "delete_cols"
SHEET_ADD = "sheet_add"
SHEET_DELETE = "sheet_delete"
SHEET_RENAME = "sheet_rename"
COPY_SHEET = "copy_sheet"
PIVOT = "pivot"
# --- 정지 시 스냅샷 diff 로 잡는 객체/속성 (이벤트 없음, Docs/15) ---
NAME_ADD = "name_add"        # 이름 정의(Named Range)
COMMENT_SET = "comment_set"  # 셀 메모(주석/노트)
TABLE_ADD = "table_add"      # 표(ListObject)
HYPERLINK_ADD = "hyperlink_add"  # 하이퍼링크
FREEZE = "freeze"            # 틀 고정
GROUP = "group"              # 행/열 그룹(개요)
VALIDATION = "validation"    # 데이터 유효성 검사
COND_FORMAT = "cond_format"  # 조건부 서식
CHART_ADD = "chart_add"      # 차트(best-effort: 종류+소스+위치)
PIVOT_ADD = "pivot_add"      # 피벗 테이블 재구성(best-effort: 소스+필드배치)
SELECTION = "selection"  # 약한 신호: 코드 생성 X, 경계 추론용

#: 코드/리플레이 대상이 아닌 약한 신호 kind
WEAK_KINDS = {SELECTION}


@dataclass
class Target:
    """동작 대상 위치. book 은 워크북 식별자(Docs/07 §7.6)."""
    book: str
    sheet: str = ""
    range: str = ""

    def to_dict(self) -> dict:
        return {"book": self.book, "sheet": self.sheet, "range": self.range}

    @classmethod
    def from_dict(cls, d: dict) -> "Target":
        return cls(book=d.get("book", ""), sheet=d.get("sheet", ""), range=d.get("range", ""))


@dataclass
class Action:
    seq: int
    kind: str
    target: Target
    payload: dict = field(default_factory=dict)
    evidence: dict = field(default_factory=dict)
    weak: bool = False

    def to_dict(self) -> dict:
        return {
            "seq": self.seq,
            "kind": self.kind,
            "target": self.target.to_dict(),
            "payload": self.payload,
            "evidence": self.evidence,
            "weak": self.weak,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Action":
        return cls(
            seq=int(d["seq"]),
            kind=d["kind"],
            target=Target.from_dict(d.get("target", {})),
            payload=d.get("payload") or {},
            evidence=d.get("evidence") or {},
            weak=bool(d.get("weak", False)),
        )
