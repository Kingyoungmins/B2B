---
type: function
title: _resolve_ephemeral_excel_open_sheet_alias
module: serve_b2b.py
lang: python
extraction: ast
signature: "(requested, names)"
role: "Map stale excel_open_<uuid> sheet names from HTML/CSV-compatible opens."
role_source: docstring
version: "0.8.1"
loc: "serve_b2b.py:3476-3491"

# ── 입출력 ──
inputs:
  - "requested"
  - "names"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_is_ephemeral_excel_open_sheet_name"
calls_external:
  - "clean_names"
  - "len"
  - "n"
  - "requested"
  - "str"
  - "strip"
called_by:
  - "ExcelSkillContext._find_sheet_name"
  - "OpenpyxlSkillContext._find_sheet_name"
  - "PythonComSkillContext._ws"
  - "_run_vba_pipeline_on_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
Map stale excel_open_<uuid> sheet names from HTML/CSV-compatible opens.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_is_ephemeral_excel_open_sheet_name`
- 피호출(영향 전파 경로): `ExcelSkillContext._find_sheet_name`, `OpenpyxlSkillContext._find_sheet_name`, `PythonComSkillContext._ws`, `_run_vba_pipeline_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
