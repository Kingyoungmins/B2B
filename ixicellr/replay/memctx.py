"""인메모리 재현 ctx — replay/ctx.py 의 헬퍼 시그니처를 그대로 따르되 Excel COM 대신
파이썬 dict 에 적용한다. 용도: '스킬 코드 두 개가 재현 결과가 같은가'를 COM 없이 판정
(ctx 헬퍼 통합의 등가 게이트) + 오프라인 테스트. 상태 의존 연산(sort/insert/delete 등)도
지원하되, 등가 판정은 결정론 write 계열에 한정해 쓴다(호출측 정책).

replay/ctx.py 와 같은 A1/그리드 규약. 시트는 접근 시 자동 생성(관대) — 두 코드가 같은
방식으로 시트를 만들므로 등가 비교에 안전하다.
"""
from __future__ import annotations

import re

_A1 = re.compile(r"^\$?([A-Za-z]+)\$?(\d+)$")


def _col_to_idx(letters: str) -> int:
    n = 0
    for ch in letters.upper():
        n = n * 26 + (ord(ch) - 64)
    return n


def _parse_cell(a1: str):
    m = _A1.match(a1.strip())
    if not m:
        raise ValueError(f"bad cell: {a1!r}")
    return int(m.group(2)), _col_to_idx(m.group(1))


def _parse_range(a1: str):
    a1 = a1.strip()
    if ":" in a1:
        p, q = a1.split(":", 1)
        (r1, c1), (r2, c2) = _parse_cell(p), _parse_cell(q)
        return min(r1, r2), min(c1, c2), max(r1, r2), max(c1, c2)
    r, c = _parse_cell(a1)
    return r, c, r, c


def _axis_index(val):
    if isinstance(val, int):
        return val
    s = str(val)
    if s.isdigit():
        return int(s)
    m = re.match(r"^\$?([A-Za-z]+)", s)
    if m and m.group(1).isalpha():
        return _col_to_idx(m.group(1))
    return _parse_cell(s.split(":")[0])[0]


class _Sheet:
    def __init__(self):
        self.cells = {}      # (row, col) -> value
        self.merges = set()
        self.fmt = {}        # (row, col) -> frozenset of format facets (셀단위 → 범위병합 등가)

    def used_grid(self):
        if not self.cells:
            return [[None]]
        maxr = max(r for r, _ in self.cells)
        maxc = max(c for _, c in self.cells)
        return [[self.cells.get((r, c)) for c in range(1, maxc + 1)]
                for r in range(1, maxr + 1)]


class MemCtx:
    """replay ctx 의 인메모리 대역. 모든 mutation 은 self.calls 로 카운트."""

    def __init__(self, seed=None):
        self.sheets = {}
        self.calls = 0
        # (sheet, row, col) -> 마지막으로 write/write_formulas 한 값(None 포함). 최종 셀
        # 상태(cells, None 제거)와 달리 '어떤 셀을 건드렸는가'를 보존한다 → gap 덮어쓰기
        # 검출용(touched_equivalent). digest 는 None 셀과 미기입 셀을 구분 못 하므로 별도.
        self.writes = {}
        for name, grid in (seed or {}).items():
            self._seed(name, grid)

    def _seed(self, name, grid):
        sh = _Sheet()
        for r, row in enumerate(grid, 1):
            row = row if isinstance(row, (list, tuple)) else [row]
            for c, v in enumerate(row, 1):
                if v is not None and v != "":
                    sh.cells[(r, c)] = v
        self.sheets[name] = sh

    def _sh(self, name):
        sh = self.sheets.get(name)
        if sh is None:
            sh = self.sheets[name] = _Sheet()  # 자동 생성(관대)
        return sh

    def _bump(self):
        self.calls += 1

    # ── 값/수식 ──
    def write(self, sheet, a1_start, grid):
        self._bump()
        sh = self._sh(sheet)
        r0, c0 = _parse_cell(a1_start)
        rows = grid if isinstance(grid, (list, tuple)) else [[grid]]
        for dr, row in enumerate(rows):
            row = row if isinstance(row, (list, tuple)) else [row]
            for dc, v in enumerate(row):
                key = (r0 + dr, c0 + dc)
                self.writes[(sheet, key[0], key[1])] = v  # 원시 기록(None 포함)
                if v is None or v == "":
                    sh.cells.pop(key, None)
                else:
                    sh.cells[key] = v
        return len(rows)

    def write_formulas(self, sheet, a1_start, grid):
        self._bump()
        sh = self._sh(sheet)
        r0, c0 = _parse_cell(a1_start)
        for dr, row in enumerate(grid):
            row = row if isinstance(row, (list, tuple)) else [row]
            for dc, v in enumerate(row):
                sh.cells[(r0 + dr, c0 + dc)] = v  # 수식 문자열 리터럴 보존
                self.writes[(sheet, r0 + dr, c0 + dc)] = v
        return len(grid)

    def clear(self, sheet, a1):
        self._bump()
        sh = self._sh(sheet)
        r1, c1, r2, c2 = _parse_range(a1)
        for r in range(r1, r2 + 1):
            for c in range(c1, c2 + 1):
                sh.cells.pop((r, c), None)
        return True

    def merge(self, sheet, a1):
        self._bump()
        # union 주소는 개별 영역으로 — 실행부(PythonComSkillContext.merge)와 의미 일치.
        sh = self._sh(sheet)
        for part in str(a1).split(","):
            part = part.strip()
            if not part:
                continue
            sh.merges.add(_norm(part))
            # 실제 Excel 은 병합 시 좌상단 외 셀 값을 소거한다. 이를 모델링하지 않으면
            # 등가 게이트가 write→merge 순서를 바꾼 후보를 false-accept 할 수 있다
            # (좌상단 외 값이 남아 결과가 실행부와 달라짐). 좌상단만 남기고 나머지 pop.
            r1, c1, r2, c2 = _parse_range(part)
            for r in range(r1, r2 + 1):
                for c in range(c1, c2 + 1):
                    if (r, c) != (r1, c1):
                        sh.cells.pop((r, c), None)

    def unmerge(self, sheet, a1):
        self._bump()
        self._sh(sheet).merges.discard(_norm(a1))

    # ── 서식(셀 단위 최종상태 — A1..A5 개별과 A1:A5 범위가 등가가 되도록) ──
    def _apply_facet(self, sheet, a1, facet):
        sh = self._sh(sheet)
        r1, c1, r2, c2 = _parse_range(a1)
        tag = facet[0]
        for r in range(r1, r2 + 1):
            for c in range(c1, c2 + 1):
                cur = {f for f in sh.fmt.get((r, c), ()) if f[0] != tag}
                cur.add(facet)
                sh.fmt[(r, c)] = frozenset(cur)  # 같은 종류는 마지막 값이 이김

    def apply_format_state(self, sheet, a1, fmt):
        self._bump()
        self._apply_facet(sheet, a1, ("state", _freeze(fmt)))
        # 실행부와 동일: merge_area 는 그 주소로만, 없고 merge 만 있으면 a1 로 병합.
        if isinstance(fmt, dict):
            area = fmt.get("merge_area")
            if area:
                self.merge(sheet, area)
            elif fmt.get("merge"):
                self.merge(sheet, a1)

    def set_number_format(self, sheet, a1, fmt):
        self._bump()
        self._apply_facet(sheet, a1, ("numfmt", fmt))

    def set_fill(self, sheet, a1, rgb):
        self._bump()
        self._apply_facet(sheet, a1, ("fill", rgb))

    def set_borders(self, sheet, a1, weight=2, line_style=1):
        self._bump()
        self._apply_facet(sheet, a1, ("border", weight, line_style))

    def apply_filter(self, sheet, a1, fields):
        self._bump()  # 값 무영향(가시성만) — 트레이스 생략(등가엔 write 계열만 씀)

    def apply_filter_state(self, sheet, a1, fields=None):
        self._bump()  # 녹화 재현용 fields 표면 — 동일하게 가시성만

    def set_column_width(self, sheet, cols, width):
        self._bump()

    def set_row_height(self, sheet, rows, height):
        self._bump()

    # ── 상태 의존(등가 게이트에선 제외 대상이나, 재현 정합엔 지원) ──
    def sort(self, sheet, a1, key_col=1, ascending=True, has_header=True):
        self._bump()
        sh = self._sh(sheet)
        r1, c1, r2, c2 = _parse_range(a1)
        head = r1 if has_header else None
        body = [r for r in range(r1, r2 + 1) if r != head]
        keyc = c1 + (key_col - 1 if isinstance(key_col, int) else 0)
        snap = {(r, c): sh.cells.get((r, c)) for r in body for c in range(c1, c2 + 1)}

        def k(r):
            v = sh.cells.get((r, keyc))
            return (v is None, v if isinstance(v, (int, float))
                    else str(v) if v is not None else "")
        for new_r, old_r in zip(body, sorted(body, key=k, reverse=not ascending)):
            for c in range(c1, c2 + 1):
                v = snap.get((old_r, c))
                if v is None:
                    sh.cells.pop((new_r, c), None)
                else:
                    sh.cells[(new_r, c)] = v
        return True

    def _shift(self, sh, at, count, axis, delete):
        new = {}
        for (r, c), v in sh.cells.items():
            idx = r if axis == "row" else c
            if delete:
                if at <= idx < at + count:
                    continue
                nidx = idx - count if idx >= at + count else idx
            else:
                nidx = idx + count if idx >= at else idx
            new[(nidx, c) if axis == "row" else (r, nidx)] = v
        sh.cells = new

    def insert_rows(self, sheet, row, count=1):
        self._bump(); self._shift(self._sh(sheet), _axis_index(row), count, "row", False)

    def delete_rows(self, sheet, row, count=1):
        self._bump(); self._shift(self._sh(sheet), _axis_index(row), count, "row", True)

    def insert_cols(self, sheet, col, count=1):
        self._bump(); self._shift(self._sh(sheet), _axis_index(col), count, "col", False)

    def delete_cols(self, sheet, col, count=1):
        self._bump(); self._shift(self._sh(sheet), _axis_index(col), count, "col", True)

    def add_sheet(self, name=None, after=True):
        self._bump(); self._sh(name)

    def delete_sheet(self, name):
        self._bump(); self.sheets.pop(name, None)

    def rename_sheet(self, old, new):
        self._bump()
        if old in self.sheets:
            self.sheets[new] = self.sheets.pop(old)

    def copy_sheet(self, src_sheet, new_name=None, after=True):
        self._bump()
        # replay/ctx.py copy_sheet 와 동일한 멱등 규칙(대상 이름 존재 시 재사용) —
        # 등가 게이트가 실제 재현과 같은 의미로 판정하도록 미러링.
        if new_name and new_name in self.sheets:
            return new_name
        src = self._sh(src_sheet)
        dup = _Sheet()
        dup.cells = dict(src.cells)
        dup.merges = set(src.merges)
        self.sheets[new_name or (src_sheet + " (2)")] = dup

    def paste_copied(self, src_sheet, src_range, dst_sheet, dst_cell,
                     src_book=None, dst_book=None, values_only=False):
        self._bump()
        src = self._sh(src_sheet)
        r1, c1, r2, c2 = _parse_range(src_range)
        grid = [[src.cells.get((r, c)) for c in range(c1, c2 + 1)]
                for r in range(r1, r2 + 1)]
        self.calls -= 1  # write 가 다시 bump 하므로 상쇄
        self.write(dst_sheet, dst_cell, grid)

    def paste_special(self, src_sheet, src_range, dst_sheet, dst_cell, mode="all"):
        return self.paste_copied(src_sheet, src_range, dst_sheet, dst_cell)

    # ── 상태 다이제스트(전 시트) ──
    def state_digest(self, digest_grid):
        parts = []
        for name in sorted(self.sheets):
            sh = self.sheets[name]
            fmt = sorted((rc, sorted(map(repr, facets))) for rc, facets in sh.fmt.items())
            parts.append(f"{name}:{digest_grid(sh.used_grid())}:"
                         f"{sorted(sh.merges)}:{fmt}")
        return "|".join(parts)


def _norm(a1):
    return str(a1).replace("$", "")


def _freeze(fmt):
    if isinstance(fmt, dict):
        return tuple(sorted((str(k), _freeze(v)) for k, v in fmt.items()))
    if isinstance(fmt, (list, tuple)):
        return tuple(_freeze(x) for x in fmt)
    return fmt
