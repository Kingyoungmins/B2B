---
type: function
title: _opxl_copy_cell_presentation
module: serve_b2b.py
lang: python
extraction: ast
signature: "(src_ws, src_row, src_col, dst_ws, dst_row, dst_col)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.19"
loc: "serve_b2b.py:12986-13034"

# ── 입출력 ──
inputs:
  - "src_ws"
  - "src_row"
  - "src_col"
  - "dst_ws"
  - "dst_row"
  - "dst_col"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_opxl_unmerge_overlapping"
  - "cell"
  - "copy"
calls_external:
  - "CellRange"
  - "dst_col"
  - "dst_row"
  - "dst_ws"
  - "get"
  - "get_column_letter"
  - "getattr"
  - "int"
  - "list"
  - "merge_cells"
  - "src"
  - "src_col"
  - "src_row"
  - "str"
  - "target"
called_by:
  - "_OpxlCellProxy.value"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_opxl_unmerge_overlapping`, `cell`, `copy`
- 피호출(영향 전파 경로): `_OpxlCellProxy.value`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
