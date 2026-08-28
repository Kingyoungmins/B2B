---
type: function
title: _sheet_snapshot
module: serve_b2b.py
lang: python
extraction: ast
signature: "(ws)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.1"
loc: "serve_b2b.py:16507-16538"

# ── 입출력 ──
inputs:
  - "ws"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "Range"
  - "_col_letter"
  - "_com_scalar"
  - "_range_matrix"
  - "row"
  - "value"
  - "values"
calls_external:
  - "_SNAPSHOT_MAX_COLS"
  - "_SNAPSHOT_MAX_ROWS"
  - "col_num"
  - "enumerate"
  - "formula"
  - "formula_row"
  - "formula_text"
  - "formulas"
  - "int"
  - "isinstance"
  - "len"
  - "min"
  - "start_col"
  - "start_row"
  - "startswith"
  - "str"
called_by:
  - "_active_sheet_snapshot"
  - "refresh_excel_session_snapshots"
reads:
  - "_SNAPSHOT_MAX_COLS"
  - "_SNAPSHOT_MAX_ROWS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `Range`, `_col_letter`, `_com_scalar`, `_range_matrix`, `row`, `value`, `values`
- 피호출(영향 전파 경로): `_active_sheet_snapshot`, `refresh_excel_session_snapshots`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
