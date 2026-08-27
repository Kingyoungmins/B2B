---
type: function
title: _col_letter_to_index
module: serve_b2b.py
lang: python
extraction: ast
signature: "(letter)"
role: "\"H\" → 8. ColumnIs 가 값 경로에서 쓸 때 필요(클래스 밖이라 컨텍스트 메서드를 못 쓴다)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12086-12095"

# ── 입출력 ──
inputs:
  - "letter"
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
  - "ch"
  - "ord"
  - "str"
  - "strip"
  - "upper"
called_by:
  - "ColumnIs.__call__"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
"H" → 8. ColumnIs 가 값 경로에서 쓸 때 필요(클래스 밖이라 컨텍스트 메서드를 못 쓴다).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `ColumnIs.__call__`

## 실패/예외
- `ValueError`
