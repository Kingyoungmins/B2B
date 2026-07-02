---
type: function
title: _opxl_safe_eval_arithmetic
module: serve_b2b.py
lang: python
extraction: ast
signature: "(expr)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "serve_b2b.py:12101-12150"

# ── 입출력 ──
inputs:
  - "expr"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "ValueError"

# ── 유기적 관계 ──
calls: []
calls_external:
  - "ValueError"
  - "_eval"
  - "comparator"
  - "expr"
  - "isinstance"
  - "node"
  - "op"
  - "parse"
  - "type"
  - "zip"
called_by:
  - "_opxl_eval_formula"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_opxl_eval_formula`

## 실패/예외
- `ValueError`
