---
type: function
title: _python_com_static_check
module: serve_b2b.py
lang: python
extraction: ast
signature: "(code)"
role: "실행 전 AST 정적 게이트. 위반은 사람이 읽을 수 있는 한국어 사유로 모아 한 번에 반환."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:15062-15194"

# ── 입출력 ──
inputs:
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "add"
  - "append"
  - "value"
calls_external:
  - "PythonComSkillError"
  - "_Checker"
  - "_is_ctx_receiver"
  - "all"
  - "code"
  - "f"
  - "failures"
  - "fromkeys"
  - "func"
  - "generic_visit"
  - "get"
  - "isinstance"
  - "join"
  - "list"
  - "node"
  - "parse"
  - "pop"
  - "str"
  - "tgt"
  - "tree"
  - "unique"
  - "visit"
called_by:
  - "_exec_python_com_skill"
reads:
  - "PY_SKILL_ENTRY"
  - "self.generic_visit"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
실행 전 AST 정적 게이트. 위반은 사람이 읽을 수 있는 한국어 사유로 모아 한 번에 반환.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `append`, `value`
- 피호출(영향 전파 경로): `_exec_python_com_skill`

## 실패/예외
- `PythonComSkillError`
