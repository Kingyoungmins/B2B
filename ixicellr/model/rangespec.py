"""RangeSpec — '주소'가 아니라 '의도'로서의 범위 (Docs/11 §11.4, Docs/05 §5.2).

캡처는 최종 주소(`A1:F3`)만 본다. 하지만 사용자의 의도는 보통 주소가 아니라
**규칙**이다: "데이터 끝까지", "현재 영역", "정렬 후 상위 10", "텍스트가 찬 행만".
RangeSpec 은 그 규칙을 담고, **재현 시점의 현재 데이터에 대해** 구체 주소로 해석된다.

설계 원칙(Docs/05 §5.3): **결정론 우선**. 이 모듈의 해석은 LLM 없이 Excel 의
End/CurrentRegion/SpecialCells 와 같은 의미를 순수 파이썬으로 계산한다. 그래서
앵커 아래 열 값(또는 블록 그리드)만 있으면 Excel 없이 단위 테스트된다.

COM 은 얇게: `replay/ctx.py` 가 키열/블록을 **1회** 읽어 여기에 넘기고, 결과 주소를
받아 기존 벌크 동사로 실행한다. 셀 단위 루프 없음(저사양 유지).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from . import a1

# --- 높이(행 범위) 결정 방식 ---
H_FIXED = "fixed"            # 고정 N행 (현재 기본 동작과 동일)
H_TO_BLANK = "to_blank"      # 키열이 빌 때까지(=End(xlDown)). 행수 가변
H_REGION = "current_region"  # 아무 셀이라도 차 있으면 포함, 전부 빈 행에서 끊음
H_ALL_NONBLANK = "all_nonblank"  # 모든 열이 찬 행만(='텍스트가 가득 찬 행만')
H_TOP_N = "top_n"            # 데이터 행 중 상위 N(정렬/필터 뒤 '상위 10개')

# --- 너비(열 범위) 결정 방식 ---
W_FIXED = "fixed"            # 고정 열 수
W_TO_BLANK = "to_blank"      # 앵커 행에서 오른쪽으로 빌 때까지

#: 사람이 읽는 모드 라벨(UI 확인 다이얼로그용)
HEIGHT_LABELS = {
    H_FIXED: "고정 (캡처한 행 수 그대로)",
    H_TO_BLANK: "데이터 끝까지 (행수 가변)",
    H_REGION: "현재 영역 전체",
    H_ALL_NONBLANK: "텍스트가 가득 찬 행만",
    H_TOP_N: "정렬 후 상위 N개",
}


@dataclass
class RangeSpec:
    """앵커 + 너비규칙 + 높이규칙. 고정이면 기존 주소와 정확히 같게 동작(호환)."""
    sheet: str
    anchor: str                       # 좌상단 셀 'A1' (고정)
    width_mode: str = W_FIXED
    width: int = 1                    # W_FIXED 일 때 열 수
    height_mode: str = H_FIXED
    height: int = 1                   # H_FIXED/H_TOP_N(n) 일 때 행 수
    key_col: int = 1                  # 블록 내 1-based 키 열(빈칸 판정 기준)
    visible_only: bool = False        # 필터 결과(보이는 행)만 — COM 에서 마스크 주입

    def to_dict(self) -> dict:
        return {k: v for k, v in {
            "sheet": self.sheet, "anchor": self.anchor,
            "width_mode": self.width_mode, "width": self.width,
            "height_mode": self.height_mode, "height": self.height,
            "key_col": self.key_col, "visible_only": self.visible_only,
        }.items() if v not in (None, False)}

    @classmethod
    def from_dict(cls, d: dict) -> "RangeSpec":
        return cls(
            sheet=d.get("sheet", ""), anchor=d["anchor"],
            width_mode=d.get("width_mode", W_FIXED), width=int(d.get("width", 1)),
            height_mode=d.get("height_mode", H_FIXED), height=int(d.get("height", 1)),
            key_col=int(d.get("key_col", 1)), visible_only=bool(d.get("visible_only", False)),
        )

    @classmethod
    def from_capture(cls, sheet: str, literal_range: str, height_mode: str,
                     *, key_col: int = 1, n: int = 0, visible_only: bool = False) -> "RangeSpec":
        """캡처한 고정 주소 + 사용자가 고른 의도(height_mode) → RangeSpec 으로 승격.

        너비는 캡처 당시 열 수로 고정(보통 의도가 '행'에 있음). 높이만 동적.
        """
        base = cls.fixed_from_range(sheet, literal_range)
        base.height_mode = height_mode
        base.key_col = key_col
        base.visible_only = visible_only
        if height_mode == H_TOP_N and n:
            base.height = n
        return base

    @classmethod
    def fixed_from_range(cls, sheet: str, rng: str) -> "RangeSpec":
        """기존 고정 주소 'A1:F3' → 동등한 고정 RangeSpec(하위호환 경로)."""
        parsed = a1.parse_range(rng)
        if not parsed:
            return cls(sheet=sheet, anchor=rng)  # 전열/전행 등은 그대로
        (r1, c1), (r2, c2) = parsed
        return cls(sheet=sheet, anchor=a1.make_cell(r1, c1),
                   width_mode=W_FIXED, width=c2 - c1 + 1,
                   height_mode=H_FIXED, height=r2 - r1 + 1)


def _blank(v) -> bool:
    return v is None or (isinstance(v, str) and v.strip() == "")


def _height_rows(mode: str, grid: List[list], *, key_col: int, n: int) -> int:
    """grid(앵커 아래 행들, 각 행은 블록 너비만큼의 값) → 의도가 뜻하는 행 수."""
    if mode == H_FIXED:
        return n
    kc = key_col - 1
    if mode == H_TO_BLANK:
        c = 0
        for row in grid:
            if kc >= len(row) or _blank(row[kc]):
                break
            c += 1
        return c
    if mode == H_REGION:
        c = 0
        for row in grid:
            if all(_blank(x) for x in row):
                break
            c += 1
        return c
    if mode == H_ALL_NONBLANK:
        c = 0
        for row in grid:
            if not row or any(_blank(x) for x in row):
                break
            c += 1
        return c
    if mode == H_TOP_N:
        avail = _height_rows(H_TO_BLANK, grid, key_col=key_col, n=0)
        return min(n, avail)
    raise ValueError(f"알 수 없는 height_mode: {mode}")


def _width_cols(mode: str, header_row: list, *, width: int) -> int:
    if mode == W_FIXED:
        return width
    if mode == W_TO_BLANK:
        c = 0
        for v in header_row:
            if _blank(v):
                break
            c += 1
        return c
    raise ValueError(f"알 수 없는 width_mode: {mode}")


def resolve(spec: RangeSpec, grid: List[list]) -> Optional[str]:
    """RangeSpec + 현재 블록 그리드 → 구체 주소 'A1:F12'. 데이터 0행이면 None.

    grid: 앵커 셀부터 시작하는 2D 값(충분히 큰 직사각형). blank = None/빈문자.
    너비를 먼저 정하고(앵커 행 기준), 그 너비로 각 행을 잘라 높이를 정한다.
    """
    parsed = a1.parse_cell(spec.anchor.replace("$", ""))
    if not parsed:
        return spec.anchor  # 전열/전행 등 특수표기는 그대로
    r0, c0 = parsed
    header = grid[0] if grid else []
    cols = _width_cols(spec.width_mode, header, width=spec.width)
    cols = max(cols, 1)
    block = [row[:cols] for row in grid]
    rows = _height_rows(spec.height_mode, block, key_col=spec.key_col, n=spec.height)
    if rows <= 0:
        return None
    return a1.make_range((r0, c0), (r0 + rows - 1, c0 + cols - 1))


def infer_candidates(literal_range: str, grid: List[list], *, key_col: int = 1) -> List[str]:
    """캡처된 고정 주소가 어떤 동적 규칙과 '같은 결과'였는지 추정(캡처 시 제안용).

    예: 사용자가 A2:F4 를 복사했는데, A2 부터 키열 빈칸 전까지가 정확히 3행이면
    'to_blank' 후보를 제시 → 사용자가 '예, 데이터 끝까지'를 고르면 RangeSpec 으로 승격.
    반환: 일치하는 height_mode 들(우선순위 순). 항상 H_FIXED 는 포함(현상 유지).
    """
    out = [H_FIXED]
    parsed = a1.parse_range(literal_range.replace("$", ""))
    if not parsed or not grid:
        return out
    (r1, c1), (r2, c2) = parsed
    captured_rows = r2 - r1 + 1
    cols = c2 - c1 + 1
    block = [row[:cols] for row in grid]
    for mode in (H_TO_BLANK, H_REGION, H_ALL_NONBLANK):
        try:
            if _height_rows(mode, block, key_col=key_col, n=0) == captured_rows:
                out.append(mode)
        except ValueError:
            pass
    return out
