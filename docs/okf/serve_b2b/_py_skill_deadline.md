---
type: function
title: _py_skill_deadline
module: serve_b2b.py
lang: python
extraction: ast
signature: "(timeout_s=None)"
role: "Python 스킬 실행 데드라인(monotonic). 유효 타임아웃이 0/음수면 무제한(inf)."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:11207-11210"

# ── 입출력 ──
inputs:
  - "timeout_s"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "float"
  - "monotonic"
  - "timeout_s"
called_by:
  - "PythonComSkillContext.__init__"
  - "_exec_python_com_skill"
reads:
  - "PY_SKILL_TIMEOUT_S"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
Python 스킬 실행 데드라인(monotonic). 유효 타임아웃이 0/음수면 무제한(inf).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `PythonComSkillContext.__init__`, `_exec_python_com_skill`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
