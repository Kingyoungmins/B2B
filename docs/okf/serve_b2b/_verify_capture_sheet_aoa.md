---
type: function
title: _verify_capture_sheet_aoa
module: serve_b2b.py
lang: python
extraction: ast
signature: "(wb, sheet_name)"
role: "대상 시트(없으면 전 시트)의 UsedRange 값을 {시트명: 2차원리스트} 로 캡처(diff 입력용)."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:16180-16203"

# ── 입출력 ──
inputs:
  - "wb"
  - "sheet_name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Worksheets"
  - "_com_scalar"
  - "_range_matrix"
  - "range"
calls_external:
  - "c"
  - "int"
  - "sheet_name"
  - "str"
called_by:
  - "_verify_step_isolated_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
대상 시트(없으면 전 시트)의 UsedRange 값을 {시트명: 2차원리스트} 로 캡처(diff 입력용).

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Worksheets`, `_com_scalar`, `_range_matrix`, `range`
- 피호출(영향 전파 경로): `_verify_step_isolated_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
