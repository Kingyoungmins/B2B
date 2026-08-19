---
type: function
title: _user_facing_workbook_names
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app)"
role: "사용자에게 보여줄 수 있는(=코드에 그대로 써도 되는) 열린 워크북 이름만."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:8128-8150"

# ── 입출력 ──
inputs:
  - "app"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
calls_external:
  - "Path"
  - "match"
  - "name"
  - "stem"
  - "str"
  - "upper"
called_by:
  - "PythonComSkillContext.book"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
사용자에게 보여줄 수 있는(=코드에 그대로 써도 되는) 열린 워크북 이름만.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `append`
- 피호출(영향 전파 경로): `PythonComSkillContext.book`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
