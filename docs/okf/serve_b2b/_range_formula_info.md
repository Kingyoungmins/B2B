---
type: function
title: _range_formula_info
module: serve_b2b.py
lang: python
extraction: ast
signature: "(rng)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.5"
loc: "serve_b2b.py:15868-15898"

# ── 입출력 ──
inputs:
  - "rng"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "_com_scalar"
  - "_excel_address"
  - "cell"
  - "replace"
calls_external:
  - "formula"
  - "isinstance"
  - "startswith"
  - "str"
called_by:
  - "_get_excel_hover_info_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `_com_scalar`, `_excel_address`, `cell`, `replace`
- 피호출(영향 전파 경로): `_get_excel_hover_info_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
