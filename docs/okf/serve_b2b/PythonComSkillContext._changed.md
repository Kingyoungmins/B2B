---
type: method
title: PythonComSkillContext._changed
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self)"
role: "---- 마무리/롤백 ----"
role_source: banner
version: "0.7.3"
loc: "serve_b2b.py:14082-14083"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "bool"
called_by:
  - "_exec_python_com_skill"
reads:
  - "self._shared"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
---- 마무리/롤백 ----

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_exec_python_com_skill`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
