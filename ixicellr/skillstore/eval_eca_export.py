"""ixi-Cell-R(.icr) → eval_eca 스킬(logic.json) 내보내기.

두 도구는 패러다임이 반대다(README): ixi-Cell-R 은 '녹화한 선언적 액션', eval_eca 는
'Python/JS 코드 파이프라인'. eval_eca 의 exe 로 불러오려면 액션을 eval_eca 의 ctx API
를 호출하는 **straight-line Python `transform(ctx)` 코드**로 변환해 `version:3 / type:
mvno-logic / pipeline[...]` 형식의 zip 으로 싸야 한다.

매핑(eval_eca ctx 표면):
  range_fill/cell_edit(value)  → ctx.write(sheet, start, grid)
  cell_edit/range_fill(formula)→ ctx.write_formulas(sheet, start, grid)
  clear                        → ctx.clear(sheet, range)
  merge / unmerge              → ctx.merge / ctx.unmerge(sheet, range)
  sort                         → ctx.sort(sheet, range, key_col, ascending, has_header)
  copy_paste                   → ctx.paste_copied(src_sheet, src_range, dst_sheet, dst_cell,
                                                  src_book, dst_book, values_only)
  format(number_format만)      → ctx.set_number_format(sheet, range, fmt)
  sheet_add/delete/rename      → ctx.add_sheet / delete_sheet / rename_sheet
  copy_sheet                   → ctx.copy_sheet(src, new_name=...)

제약:
  - 서식/필터/열너비는 eval_eca 에 역이식된 apply_format_state / apply_filter_state /
    set_column_width·set_row_height 로 옮긴다(구 버전 eval_eca 에는 이 동사가 없으므로
    최신 eval_eca 필요).
  - 정적 게이트가 반복 루프+write 를 막으므로 **스텝을 펼친 일렬 코드**로 생성한다.

zip 은 eval_eca 의 커스텀 unzip(저장 무압축 가정)과의 호환을 위해 **ZIP_STORED**.
"""
from __future__ import annotations

import json
import os
import zipfile
from typing import List, Optional

from ..model import a1
from ..model.action_ir import (
    CELL_EDIT, CLEAR, COPY_PASTE, COPY_SHEET, DELETE_COLS, DELETE_ROWS, DIMENSION,
    INSERT_COLS, INSERT_ROWS, MERGE, RANGE_FILL, SHEET_ADD, SHEET_DELETE, SHEET_RENAME,
    SORT, UNMERGE,
)

EVAL_ECA_SCHEMA_VERSION = 3
EVAL_ECA_TYPE = "mvno-logic"


def _start_cell(rng: str) -> str:
    parsed = a1.parse_range(rng)
    return a1.make_cell(*parsed[0]) if parsed else rng


def _pylit(v) -> str:
    """파이썬 리터럴로 안전 직렬화. repr 은 None/숫자/한글 문자열/중첩리스트를 그대로 보존."""
    return repr(v)


def _base(book: str) -> str:
    return os.path.basename((book or "").replace("\\", "/"))


def step_to_lines(step) -> List[str]:
    """한 스텝 → eval_eca ctx 호출 코드 줄들. 옮길 수 없으면 주석 한 줄."""
    k = step.kind
    t = step.target
    p = step.payload or {}
    sheet = t.sheet if t else ""
    rng = t.range if t else ""

    if k in (RANGE_FILL, CELL_EDIT):
        start = _start_cell(rng)
        if p.get("mode") == "formula":
            grid = p.get("formulas")
            if grid is None:
                return [f"    # (건너뜀) 수식 데이터 없음: {sheet}!{rng}"]
            return [f"    ctx.write_formulas({sheet!r}, {start!r}, {_pylit(grid)})"]
        grid = p.get("values")
        if grid is None:
            return [f"    # (건너뜀) 값 데이터 없음(deferred): {sheet}!{rng}"]
        return [f"    ctx.write({sheet!r}, {start!r}, {_pylit(grid)})"]

    if k == CLEAR:
        return [f"    ctx.clear({sheet!r}, {rng!r})"]
    if k == MERGE:
        return [f"    ctx.merge({sheet!r}, {rng!r})"]
    if k == UNMERGE:
        return [f"    ctx.unmerge({sheet!r}, {rng!r})"]
    if k == SORT:
        return [f"    ctx.sort({sheet!r}, {rng!r}, key_col={p.get('key_col', 1)!r}, "
                f"ascending={bool(p.get('ascending', True))!r}, "
                f"has_header={bool(p.get('has_header', True))!r})"]
    if k == INSERT_COLS:
        return [f"    ctx.insert_cols({sheet!r}, {p.get('index', rng)!r}, count={int(p.get('count', 1))!r})"]
    if k == INSERT_ROWS:
        return [f"    ctx.insert_rows({sheet!r}, {p.get('index', rng)!r}, count={int(p.get('count', 1))!r})"]
    if k == DELETE_COLS:
        return [f"    ctx.delete_cols({sheet!r}, {p.get('index', rng)!r}, count={int(p.get('count', 1))!r})"]
    if k == DELETE_ROWS:
        return [f"    ctx.delete_rows({sheet!r}, {p.get('index', rng)!r}, count={int(p.get('count', 1))!r})"]
    if k == COPY_PASTE:
        s = step.source
        if not s:
            return [f"    # (건너뜀) 복붙 소스 없음: {sheet}!{rng}"]
        dst_cell = _start_cell(rng)
        # [재현 결정성] 복사 시점 값 스냅샷이 있으면 그 값을 결정적으로 쓴다. paste_copied 는
        # 재현 시 소스를 '리셋된 원본'에서 다시 읽어, 녹화 중 만든 데이터를 복사한 경우 빈값이
        # 됐다(사용자: "텍스트가 다 안 채워짐"). 값 스냅샷은 리셋 상태와 무관해 항상 정확.
        # (수식은 값으로 고정됨 — 값 누락 방지가 우선. 서식은 서식 diff 가 별도로 재현)
        pv = p.get("paste_values")
        if pv is not None:
            return [f"    ctx.write({sheet!r}, {dst_cell!r}, {_pylit(pv)})"]
        values_only = p.get("mode") == "values"
        args = [f"{s.sheet!r}", f"{s.range!r}", f"{sheet!r}", f"{dst_cell!r}"]
        if _base(s.book) != _base(t.book):  # 교차파일
            args.append(f"src_book={_base(s.book)!r}")
            args.append(f"dst_book={_base(t.book)!r}")
        args.append(f"values_only={values_only!r}")
        line = f"    ctx.paste_copied({', '.join(args)})"
        spec = p.get("source_spec")
        note = []
        if spec and spec.get("height_mode") not in (None, "fixed"):
            note = [f"    # 주의: 원본 의도='{spec.get('height_mode')}'(동적 범위) — "
                    f"eval_eca 에선 고정 범위 {s.range} 로 내보냄"]
        return note + [line]
    if k == "format":
        # eval_eca 에 apply_format_state 가 역이식되어 서식을 통째로 옮긴다.
        fmt = p.get("format") or {kk: v for kk, v in p.items() if kk != "source"}
        return [f"    ctx.apply_format_state({sheet!r}, {rng!r}, {_pylit(fmt)})"]
    if k == "filter":
        fields = p.get("fields") or []
        return [f"    ctx.apply_filter_state({sheet!r}, {rng!r}, {_pylit(fields)})"]
    if k == DIMENSION:
        if p.get("axis") == "row":
            return [f"    ctx.set_row_height({sheet!r}, {p.get('index')!r}, {p.get('size')!r})"]
        return [f"    ctx.set_column_width({sheet!r}, {p.get('index')!r}, {p.get('size')!r})"]
    if k == SHEET_ADD:
        return [f"    ctx.add_sheet({sheet!r})"]
    if k == SHEET_DELETE:
        return [f"    ctx.delete_sheet({sheet!r})"]
    if k == SHEET_RENAME:
        old = p.get("old", sheet)
        new = p.get("new") or sheet
        return [f"    ctx.rename_sheet({old!r}, {new!r})"]
    if k == COPY_SHEET:
        s = step.source
        nm = p.get("new_name")
        src = s.sheet if s else sheet
        return [f"    ctx.copy_sheet({src!r}"
                + (f", new_name={nm!r}" if nm else "") + ")"]
    return [f"    # (미지원 스텝) {k}: {sheet}!{rng}"]


def generate_transform(skill) -> str:
    """skill 의 활성 스텝 → eval_eca Python transform(ctx) 소스(일렬 코드)."""
    lines = [
        "# ixi-Cell-R 녹화 스킬에서 자동 변환됨 (eval_eca 호환)",
        "# 주의: 서식/필터 재현에는 apply_format_state 등이 있는 최신 eval_eca 가 필요합니다.",
        "def transform(ctx):",
    ]
    body: List[str] = []
    for s in skill.steps:
        if not getattr(s, "enabled", True):
            continue
        body.extend(step_to_lines(s))
    # 실행문이 하나도 없으면(전부 미지원/주석/건너뜀) 'expected an indented block'
    # 문법 오류가 나므로 pass 를 보강한다(주석은 보존).
    if not any(str(ln).strip() and not str(ln).strip().startswith("#") for ln in body):
        body = body + ["    pass"]
    return "\n".join(lines + body) + "\n"


def build_manifest(name: str, code: str, step_filename: str, *, created: str) -> dict:
    return {
        "version": EVAL_ECA_SCHEMA_VERSION,
        "type": EVAL_ECA_TYPE,
        "name": name,
        "saveBaseName": name,
        "createdAt": created,
        "stepCount": 1,
        "pipeline": [{
            "id": "ixicellr-export-1",
            "description": "ixi-Cell-R 녹화 재현(자동 변환)",
            "enabled": True,
            "language": "python",
            "stepFile": step_filename,
            "code": code,
            "targetFileId": None,
            "targetSheetName": None,
            "trustedStatic": False,
        }],
        "chatHistory": [],
    }


def export(skill, path: str, *, name: Optional[str] = None, created: str = "") -> str:
    """skill → eval_eca 가 불러올 수 있는 .zip(logic.json + step.py). 경로 반환.

    created 는 결정성을 위해 외부에서 주입(미지정 시 빈 문자열).
    """
    name = name or (getattr(skill, "name", None) or "ixicellr_export")
    code = generate_transform(skill)
    step_filename = f"{name}_step_1.py"
    manifest = build_manifest(name, code, step_filename, created=created)
    # eval_eca 커스텀 unzip 호환을 위해 무압축(ZIP_STORED).
    with zipfile.ZipFile(path, "w", zipfile.ZIP_STORED) as z:
        z.writestr(f"{name}.logic.json",
                   json.dumps(manifest, ensure_ascii=False, indent=2))
        z.writestr(step_filename, code)
    return path
