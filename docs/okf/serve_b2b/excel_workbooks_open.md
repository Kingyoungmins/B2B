---
type: function
title: excel_workbooks_open
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, path, read_only=False, intended_name=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:2882-2942"

# ── 입출력 ──
inputs:
  - "app"
  - "path"
  - "read_only"
  - "intended_name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "파일시스템 변경/IO"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "_stash_workbook_name_alias"
  - "append"
  - "excel_compatible_open_path"
calls_external:
  - "Open"
  - "Path"
  - "RuntimeError"
  - "app"
  - "bool"
  - "err"
  - "kwargs"
  - "open_path"
  - "path"
  - "read_only"
  - "str"
  - "temp_path"
  - "unlink"
called_by:
  - "PythonComSkillContext.copy_sheet"
  - "PythonComSkillContext.paste_copied"
  - "_copy_source_workbook_into_target"
  - "_ensure_companion_workbooks"
  - "_open_excel_session_impl"
  - "_open_excel_workbook_for_skill"
  - "_reopen_excel_session_workbook"
  - "_replace_excel_session_workbook_impl"
  - "_run_full_pipeline_single_instance_impl"
  - "_setup_isolated_pipeline_instance"
  - "inspect_workbook_with_excel"
  - "load_workbook_aoa_with_excel"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 파일시스템 변경/IO

## 관계
- 호출: `_stash_workbook_name_alias`, `append`, `excel_compatible_open_path`
- 피호출(영향 전파 경로): `PythonComSkillContext.copy_sheet`, `PythonComSkillContext.paste_copied`, `_copy_source_workbook_into_target`, `_ensure_companion_workbooks`, `_open_excel_session_impl`, `_open_excel_workbook_for_skill`, `_reopen_excel_session_workbook`, `_replace_excel_session_workbook_impl`, `_run_full_pipeline_single_instance_impl`, `_setup_isolated_pipeline_instance`, `inspect_workbook_with_excel`, `load_workbook_aoa_with_excel`

## 실패/예외
- `RuntimeError`
