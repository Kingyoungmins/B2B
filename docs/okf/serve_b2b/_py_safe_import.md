---
type: function
title: _py_safe_import
module: serve_b2b.py
lang: python
extraction: ast
signature: "(name, globals=None, locals=None, fromlist=(), level=0)"
role: "[SBAGENT-296] 제공 모듈(re/datetime/math)의 단순 import 만 통과시키는 __import__."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:11982-11992"

# ── 입출력 ──
inputs:
  - "name"
  - "globals"
  - "locals"
  - "fromlist"
  - "level"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls: []
calls_external:
  - "PythonComSkillError"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[SBAGENT-296] 제공 모듈(re/datetime/math)의 단순 import 만 통과시키는 __import__.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
