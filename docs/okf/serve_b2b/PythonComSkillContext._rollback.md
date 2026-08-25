---
type: method
title: PythonComSkillContext._rollback
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self)"
role: "실패 시 저널 역순 복원(쓰기 범위만 정밀 원복). 구조 변경은 롤백 불가."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:15093-15107"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Range"
  - "Worksheets"
  - "_rollback_book"
calls_external:
  - "address"
  - "book_name"
  - "bool"
  - "entry"
  - "len"
  - "reversed"
  - "tuple"
  - "ws_name"
called_by:
  - "_exec_python_com_skill"
reads:
  - "self._rollback_book"
  - "self._shared"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
실패 시 저널 역순 복원(쓰기 범위만 정밀 원복). 구조 변경은 롤백 불가.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Range`, `Worksheets`, `_rollback_book`
- 피호출(영향 전파 경로): `_exec_python_com_skill`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
