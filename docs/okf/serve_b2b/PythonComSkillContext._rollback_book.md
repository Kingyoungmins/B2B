---
type: method
title: PythonComSkillContext._rollback_book
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, book_name)"
role: "저널에 적힌 워크북을 같은 인스턴스에서 찾는다. 못 찾으면 고정 워크북(예전 동작)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:15531-15549"

# ── 입출력 ──
inputs:
  - "self"
  - "book_name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "book_name"
  - "str"
called_by:
  - "PythonComSkillContext._rollback"
reads:
  - "self._app"
  - "self._wb"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
저널에 적힌 워크북을 같은 인스턴스에서 찾는다. 못 찾으면 고정 워크북(예전 동작).

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `PythonComSkillContext._rollback`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
