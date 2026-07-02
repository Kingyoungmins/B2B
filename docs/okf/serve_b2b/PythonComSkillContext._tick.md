---
type: method
title: PythonComSkillContext._tick
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, n=1)"
role: "---- 내부 가드 ----"
role_source: banner
version: "0.5.18"
loc: "serve_b2b.py:8516-8524"

# ── 입출력 ──
inputs:
  - "self"
  - "n"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls: []
calls_external:
  - "PythonComSkillError"
  - "monotonic"
called_by:
  - "PythonComSkillContext._journal_save"
  - "PythonComSkillContext._ws"
  - "PythonComSkillContext.add_sheet"
  - "PythonComSkillContext.append_same_format_sheets"
  - "PythonComSkillContext.book"
  - "PythonComSkillContext.clear"
  - "PythonComSkillContext.copy"
  - "PythonComSkillContext.copy_sheet"
  - "PythonComSkillContext.delete_cols"
  - "PythonComSkillContext.delete_rows"
  - "PythonComSkillContext.delete_sheet"
  - "PythonComSkillContext.filter_to_sheet"
  - "PythonComSkillContext.find_header"
  - "PythonComSkillContext.formula_mask"
  - "PythonComSkillContext.has_formulas"
  - "PythonComSkillContext.hide_cols"
  - "PythonComSkillContext.hide_rows"
  - "PythonComSkillContext.insert_cols"
  - "PythonComSkillContext.insert_rows"
  - "PythonComSkillContext.last_col"
  - "PythonComSkillContext.last_row"
  - "PythonComSkillContext.merge"
  - "PythonComSkillContext.move_col_clear"
  - "PythonComSkillContext.move_cols"
  - "PythonComSkillContext.paste_copied"
  - "PythonComSkillContext.pivot"
  - "PythonComSkillContext.read"
  - "PythonComSkillContext.read_formulas"
  - "PythonComSkillContext.rename_sheet"
  - "PythonComSkillContext.replace"
  - "PythonComSkillContext.set_number_format"
  - "PythonComSkillContext.sheets"
  - "PythonComSkillContext.shift_months"
  - "PythonComSkillContext.sort"
  - "PythonComSkillContext.unmerge"
  - "PythonComSkillContext.used_range"
  - "PythonComSkillContext.write"
  - "PythonComSkillContext.write_formulas"
reads:
  - "PY_COM_BUDGET"
  - "self._shared"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
---- 내부 가드 ----

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `PythonComSkillContext._journal_save`, `PythonComSkillContext._ws`, `PythonComSkillContext.add_sheet`, `PythonComSkillContext.append_same_format_sheets`, `PythonComSkillContext.book`, `PythonComSkillContext.clear`, `PythonComSkillContext.copy`, `PythonComSkillContext.copy_sheet`, `PythonComSkillContext.delete_cols`, `PythonComSkillContext.delete_rows`, `PythonComSkillContext.delete_sheet`, `PythonComSkillContext.filter_to_sheet`, `PythonComSkillContext.find_header`, `PythonComSkillContext.formula_mask`, `PythonComSkillContext.has_formulas`, `PythonComSkillContext.hide_cols`, `PythonComSkillContext.hide_rows`, `PythonComSkillContext.insert_cols`, `PythonComSkillContext.insert_rows`, `PythonComSkillContext.last_col`, `PythonComSkillContext.last_row`, `PythonComSkillContext.merge`, `PythonComSkillContext.move_col_clear`, `PythonComSkillContext.move_cols`, `PythonComSkillContext.paste_copied`, `PythonComSkillContext.pivot`, `PythonComSkillContext.read`, `PythonComSkillContext.read_formulas`, `PythonComSkillContext.rename_sheet`, `PythonComSkillContext.replace`, `PythonComSkillContext.set_number_format`, `PythonComSkillContext.sheets`, `PythonComSkillContext.shift_months`, `PythonComSkillContext.sort`, `PythonComSkillContext.unmerge`, `PythonComSkillContext.used_range`, `PythonComSkillContext.write`, `PythonComSkillContext.write_formulas`

## 실패/예외
- `PythonComSkillError`
