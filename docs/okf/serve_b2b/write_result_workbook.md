---
type: function
title: write_result_workbook
module: serve_b2b.py
lang: python
extraction: ast
signature: "(template_path, result_path, sheets, forced_value_cells=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:20743-20765"

# ── 입출력 ──
inputs:
  - "template_path"
  - "result_path"
  - "sheets"
  - "forced_value_cells"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "cell"
  - "is_csv_path"
  - "openpyxl_load_workbook_compatible"
  - "sheets"
  - "write_result_csv"
calls_external:
  - "c_idx"
  - "close"
  - "create_sheet"
  - "dict"
  - "enumerate"
  - "get"
  - "int"
  - "isinstance"
  - "items"
  - "r_idx"
  - "result_path"
  - "save"
  - "sheet_name"
  - "str"
  - "template_path"
called_by:
  - "ensure_result_file"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `cell`, `is_csv_path`, `openpyxl_load_workbook_compatible`, `sheets`, `write_result_csv`
- 피호출(영향 전파 경로): `ensure_result_file`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
