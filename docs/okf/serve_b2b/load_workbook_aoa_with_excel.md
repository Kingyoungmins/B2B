---
type: function
title: load_workbook_aoa_with_excel
module: serve_b2b.py
lang: python
extraction: ast
signature: "(path)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "serve_b2b.py:14887-14933"

# ── 입출력 ──
inputs:
  - "path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "Range"
  - "Worksheets"
  - "_range_matrix"
  - "_track_spawned_excel_app"
  - "append"
  - "cell_to_json"
  - "excel_workbooks_open"
  - "range"
  - "rows"
  - "value"
calls_external:
  - "Close"
  - "DispatchEx"
  - "Path"
  - "Quit"
  - "app"
  - "cols"
  - "int"
  - "path"
  - "pop"
  - "row_values"
  - "sheet_idx"
  - "str"
  - "temp_path"
  - "unlink"
called_by:
  - "load_workbook_aoa"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 파일시스템 변경/IO

## 관계
- 호출: `Cells`, `Range`, `Worksheets`, `_range_matrix`, `_track_spawned_excel_app`, `append`, `cell_to_json`, `excel_workbooks_open`, `range`, `rows`, `value`
- 피호출(영향 전파 경로): `load_workbook_aoa`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
