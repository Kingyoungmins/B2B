---
type: function
title: _whoami
module: b2b_telemetry.py
lang: python
extraction: ast
signature: "()"
role: "cmd whoami 와 같은 값. serve_b2b 에 같은 함수가 있지만 의존하지 않는다"
role_source: docstring
version: "0.8.1"
loc: "b2b_telemetry.py:99-112"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "get"
  - "getuser"
  - "lower"
called_by:
  - "_log_skill_run_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
cmd whoami 와 같은 값. serve_b2b 에 같은 함수가 있지만 의존하지 않는다

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_log_skill_run_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
