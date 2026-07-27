"""의도·위험 주석기 (Docs/04 §4.1, Docs/05 §5.2 — '캡처는 데이터, 의도는 추론').

캡처는 사용자가 '무엇을 했는지(결과 데이터)'만 본다. '왜 했는지(의도)'는 못 본다.
그래서 같은 스텝이라도 **다음 입력/다음 달에 그대로 재현하면 틀리는 것**과
**그대로 재현해야 맞는 것**이 섞인다. 이 모듈은 COM 없이(순수 함수) 각 스텝을
훑어 **역할(role)** 을 분류하고 **위험(hazard)** 을 표시한다. 저장 직전 요약으로
사용자에게 보여, 의도를 사람이 한 번 확인/보정할 지점을 만든다.

핵심: 여기서 무엇을 '하지' 않는다 — 자동으로 스텝을 고치거나 지우지 않는다.
오직 분류·경고만 한다(Docs/05 §5.4 'LLM은 적응기, 생성기 아님'과 같은 철학).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from ..model.action_ir import (
    CELL_EDIT, CLEAR, COPY_PASTE, COPY_SHEET, DELETE_COLS, DELETE_ROWS, DIMENSION,
    FILTER, FORMAT, INSERT_COLS, INSERT_ROWS, MERGE, RANGE_FILL,
    SHEET_ADD, SHEET_DELETE, SHEET_RENAME, SORT, UNMERGE,
)

# --- 역할(role): 재현 안정성 관점의 분류 ---
ROLE_STRUCTURE = "structure"     # 시트/병합/차원 — 보통 그대로 재현 안전
ROLE_FORMAT = "format"           # 서식 — 그대로 재현 안전
ROLE_FORMULA = "formula"         # 수식 — 참조가 살아있으면 다음 입력에도 유효
ROLE_LITERAL = "literal_data"    # 하드코딩 값 블록 — 다음 달엔 보통 '새 입력'이어야 함
ROLE_COPY = "copy"               # 복붙 — source 가 살아있어야 함
ROLE_OTHER = "other"

# --- 위험(hazard) 코드 ---
HZ_BROKEN_REF = "broken_ref"        # 수식에 #REF!/#NAME? 등 — 캡처 순간 이미 깨짐
HZ_TEXT_AS_FORMULA = "text_as_formula"  # 숫자/문자를 mode=formula 로 → 텍스트로 박힘
HZ_LITERAL_BLOCK = "literal_block"  # 큰 하드코딩 값 블록 — 매달 그대로면 틀림
HZ_TRANSIENT_SHEET = "transient_sheet"  # 기본명 시트(Sheet1 등) — 임시 시트일 수 있음
HZ_FULL_AXIS = "full_axis"          # 전열/전행 대상 — 과대 적용 위험
HZ_DESTRUCTIVE = "destructive"      # 행/열/시트 삭제 — 구조가 다르면 엉뚱한 데이터 삭제
HZ_CROSS_FILE = "cross_file"        # 교차파일 복사 — 원본 파일이 함께 열려 있어야 재현
HZ_REORDERED = "reordered"          # distiller 가 실행 순서를 재배치 — 개입 편집이 있어 재현 순서가 다를 수 있음

#: 엑셀 오류 토큰(수식에 박히면 캡처 순간 이미 깨진 것)
_ERROR_TOKENS = ("#REF!", "#NAME?", "#DIV/0!", "#VALUE!", "#N/A", "#NULL!", "#NUM!")

#: '임시 시트'로 의심되는 기본 시트명(언어별). 정확 일치 + 'SheetN'/'SheN' 접두.
_DEFAULT_SHEET_PREFIXES = ("sheet", "시트")

#: 이 셀 수를 넘는 하드코딩 값/수식 블록은 '새 입력일 것' 후보로 본다.
LITERAL_BLOCK_CELLS = 12

HAZARD_LABELS = {
    HZ_BROKEN_REF: "깨진 참조(#REF! 등) — 캡처 순간 이미 오류. 그대로 재현해도 오류가 박힙니다.",
    HZ_TEXT_AS_FORMULA: "숫자를 수식모드로 캡처 — 재현 시 '텍스트'로 들어가 계산이 깨질 수 있습니다.",
    HZ_LITERAL_BLOCK: "하드코딩 값 블록 — 이번 달 숫자입니다. 다음 달엔 보통 새 입력이어야 맞습니다.",
    HZ_TRANSIENT_SHEET: "기본명 시트(Sheet1 등) — 임시 시트일 수 있어, 다른 파일엔 그 시트가 없을 수 있습니다.",
    HZ_FULL_AXIS: "전열/전행 대상 — 의도보다 넓게 적용될 수 있습니다.",
    HZ_DESTRUCTIVE: "행/열/시트 삭제 — 다음 파일의 구조가 다르면 엉뚱한 데이터를 지울 수 있습니다.",
    HZ_CROSS_FILE: "교차파일 복사 — 원본 파일이 함께 열려 있어야 재현됩니다.",
    HZ_REORDERED: "정렬/필터 후 수동 편집이 감지됨 — 재현 순서가 녹화와 다를 수 있습니다.",
}


@dataclass
class StepIntent:
    id: str
    kind: str
    role: str
    hazards: List[str] = field(default_factory=list)
    cells: int = 0
    note: str = ""

    def to_dict(self) -> dict:
        d = {"id": self.id, "role": self.role}
        if self.hazards:
            d["hazards"] = list(self.hazards)
        if self.note:
            d["note"] = self.note
        return d


def _grid_cells(grid) -> int:
    if not isinstance(grid, list) or not grid:
        return 0
    rows = len(grid)
    cols = len(grid[0]) if isinstance(grid[0], list) else 1
    return rows * cols


def _iter_cells(grid):
    if not isinstance(grid, list):
        return
    for row in grid:
        if isinstance(row, list):
            for c in row:
                yield c
        else:
            yield row


def _looks_default_sheet(sheet: str) -> bool:
    s = (sheet or "").strip().lower()
    if not s:
        return False
    for pre in _DEFAULT_SHEET_PREFIXES:
        if s == pre or (s.startswith(pre) and s[len(pre):].strip().isdigit()):
            return True
    # 한글 '통합 문서N'(미저장 새 통합문서의 기본 시트는 Sheet1 이지만, 시트 자체가
    # 임시 통합문서일 때를 약하게 잡는다)
    return False


def _is_full_axis(rng: str) -> bool:
    """'A:E'(전열) / '1:6'(전행) 표기 — 셀 좌표가 없는 범위."""
    from ..model import a1
    if not rng or ":" not in rng:
        return False
    if "," in rng:  # union 주소("A1:B2,A4:B4") — 각 조각이 셀 좌표면 전축 아님
        return any(_is_full_axis(part) for part in rng.split(","))
    return a1.parse_range(rng) is None


def analyze_step(step) -> StepIntent:
    """스텝 1개를 역할(role)로 분류하고 재현 위험(hazard)을 표시한다 — 순수 함수(COM 무관).

    role 은 그룹핑 경계(record_service.group_steps)와 카드 제목의 근거가 되므로,
    커버리지 공백(→ ROLE_OTHER 파편화)이 곧 묶음 파편화·제목 무의미화로 이어진다.
    행/열 삽입·삭제, 시트 삭제/이름변경/복사, 필터도 구조(structure)로 정확히 분류한다."""
    kind = step.kind
    t = step.target
    p = step.payload or {}
    sheet = t.sheet if t else ""
    rng = t.range if t else ""
    si = StepIntent(id=getattr(step, "id", "?"), kind=kind, role=ROLE_OTHER)

    if kind in (FORMAT,):
        si.role = ROLE_FORMAT
    elif kind in (MERGE, UNMERGE, DIMENSION, SHEET_ADD, SORT,
                  INSERT_COLS, INSERT_ROWS, DELETE_COLS, DELETE_ROWS,
                  SHEET_DELETE, SHEET_RENAME, COPY_SHEET, FILTER):
        # 행/열 삽입·삭제와 시트 조작·필터는 전형적 '구조 변경'이다. 예전엔 ROLE_OTHER 로
        # 빠져 묶음이 "기타 작업"으로 파편화되고 위험 표시도 누락됐다.
        si.role = ROLE_STRUCTURE
        if kind in (DELETE_ROWS, DELETE_COLS, SHEET_DELETE):
            si.hazards.append(HZ_DESTRUCTIVE)
    elif kind == CLEAR:
        # 내용 지우기는 값 조작의 짝 — 값 입력 흐름 사이에 껴도 묶음을 끊지 않게 한다.
        si.role = ROLE_LITERAL
    elif kind == COPY_PASTE:
        si.role = ROLE_COPY
        src = getattr(step, "source", None)
        if src is not None and t is not None and getattr(src, "book", "") \
                and src.book != t.book:
            si.hazards.append(HZ_CROSS_FILE)
    elif kind in (RANGE_FILL, CELL_EDIT):
        mode = p.get("mode")
        grid = p.get("formulas") if mode == "formula" else p.get("values")
        si.cells = _grid_cells(grid)
        if mode == "formula":
            cells = list(_iter_cells(grid))
            has_formula = any(isinstance(c, str) and c.startswith("=") for c in cells)
            has_err = any(isinstance(c, str) and any(tok in c for tok in _ERROR_TOKENS)
                          for c in cells)
            non_formula = any(c is not None and not (isinstance(c, str) and c.startswith("="))
                              for c in cells)
            if has_err:
                si.hazards.append(HZ_BROKEN_REF)
            if non_formula:
                # 수식모드인데 '='로 시작 안 하는 셀이 섞임 → 텍스트로 박힘
                si.hazards.append(HZ_TEXT_AS_FORMULA)
            si.role = ROLE_FORMULA if has_formula else ROLE_LITERAL
        else:
            si.role = ROLE_LITERAL
        if si.role == ROLE_LITERAL and si.cells >= LITERAL_BLOCK_CELLS:
            si.hazards.append(HZ_LITERAL_BLOCK)

    # distiller 재정렬이 개입 편집을 감지해 표기한 마커(pipeline.order_source_mutations_before_copy /
    # dedupe_sheet_creations) — 재현 순서가 녹화와 갈릴 수 있음을 사용자에게 노출.
    if p.get("_reorder_hazard"):
        si.hazards.append(HZ_REORDERED)
    if _looks_default_sheet(sheet):
        si.hazards.append(HZ_TRANSIENT_SHEET)
    if _is_full_axis(rng):
        si.hazards.append(HZ_FULL_AXIS)
    return si


def analyze_steps(steps) -> List[StepIntent]:
    return [analyze_step(s) for s in steps]


def summarize(steps) -> dict:
    """저장 직전 사람이 읽는 요약. {counts, hazards:{code:[ids]}, lines:[..], has_risk}."""
    intents = analyze_steps(steps)
    roles: dict = {}
    hazards: dict = {}
    for si in intents:
        roles[si.role] = roles.get(si.role, 0) + 1
        for h in si.hazards:
            hazards.setdefault(h, []).append(si.id)
    lines: List[str] = []
    for code, ids in hazards.items():
        label = HAZARD_LABELS.get(code, code)
        lines.append(f"⚠ {label}  (스텝 {len(ids)}개: {', '.join(ids[:8])}{'…' if len(ids) > 8 else ''})")
    return {
        "counts": roles,
        "hazards": hazards,
        "lines": lines,
        "has_risk": bool(hazards),
        "intents": intents,
    }


def summary_text(steps) -> str:
    """messagebox 등에 바로 띄울 멀티라인 텍스트."""
    s = summarize(steps)
    if not s["has_risk"]:
        return ""
    head = ("이 스킬은 '한 번의 작업 결과'를 캡처한 것입니다. 캡처는 데이터만 보고\n"
            "의도(왜 했는지)는 못 봅니다. 아래 항목은 다음 파일/다음 달에 그대로\n"
            "재현하면 어긋날 수 있으니 한 번 확인하세요:\n")
    return head + "\n".join(s["lines"])
