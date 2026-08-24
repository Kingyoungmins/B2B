---
type: method
title: PythonComSkillContext.book
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, workbook_name)"
role: "같은 Excel 인스턴스에 열린 다른 업로드 파일을 대상으로 하는 ctx."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:14405-14517"

# ── 입출력 ──
inputs:
  - "self"
  - "workbook_name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "_alias_open_workbook_name"
  - "_match_workbook_by_stable_key"
  - "_tick"
  - "_user_facing_workbook_names"
  - "_vba_trace"
  - "_workbook_name_lookup_keys"
  - "append"
  - "names"
  - "normalize_sheet_lookup"
calls_external:
  - "Path"
  - "PythonComSkillContext"
  - "PythonComSkillError"
  - "_pick"
  - "bool"
  - "join"
  - "key"
  - "len"
  - "list"
  - "n"
  - "nm"
  - "open_names"
  - "pred"
  - "stable"
  - "stem_hits"
  - "str"
  - "strip"
  - "target"
  - "wb"
  - "workbook_name"
called_by:
  - "PythonComSkillContext._ctx_and_sheet_from_spec"
  - "PythonComSkillContext.append_same_format_sheets"
  - "PythonComSkillContext.copy_sheet"
  - "PythonComSkillContext.paste_copied"
  - "_verify_recorded_expected_live"
reads:
  - "self._app"
  - "self._session"
  - "self._shared"
  - "self._tick"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
같은 Excel 인스턴스에 열린 다른 업로드 파일을 대상으로 하는 ctx.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_alias_open_workbook_name`, `_match_workbook_by_stable_key`, `_tick`, `_user_facing_workbook_names`, `_vba_trace`, `_workbook_name_lookup_keys`, `append`, `names`, `normalize_sheet_lookup`
- 피호출(영향 전파 경로): `PythonComSkillContext._ctx_and_sheet_from_spec`, `PythonComSkillContext.append_same_format_sheets`, `PythonComSkillContext.copy_sheet`, `PythonComSkillContext.paste_copied`, `_verify_recorded_expected_live`

## 실패/예외
- `PythonComSkillError`
