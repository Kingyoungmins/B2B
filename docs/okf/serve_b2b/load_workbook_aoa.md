---
type: function
title: load_workbook_aoa
module: serve_b2b.py
lang: python
extraction: ast
signature: "(path)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:19552-19573"

# ── 입출력 ──
inputs:
  - "path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
  - "cell_to_json"
  - "excel_available"
  - "is_csv_path"
  - "iter_rows"
  - "load_csv_aoa"
  - "load_workbook_aoa_with_excel"
  - "openpyxl_load_workbook_compatible"
  - "values"
calls_external:
  - "close"
  - "path"
  - "pop"
called_by:
  - "get_workbook_aoa_for_run"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`, `cell_to_json`, `excel_available`, `is_csv_path`, `iter_rows`, `load_csv_aoa`, `load_workbook_aoa_with_excel`, `openpyxl_load_workbook_compatible`, `values`
- 피호출(영향 전파 경로): `get_workbook_aoa_for_run`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
