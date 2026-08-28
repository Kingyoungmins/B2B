---
type: function
title: _upstream_config
module: log_dash.py
lang: python
extraction: ast
signature: "()"
role: "log_sync 와 같은 원천(환경변수 > F9 설정 > 기본값). import 실패 시에도 죽지 않는다."
role_source: docstring
version: "0.8.1"
loc: "log_dash.py:34-41"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "config"
calls_external:
  - "get"
called_by:
  - "build_request"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
log_sync 와 같은 원천(환경변수 > F9 설정 > 기본값). import 실패 시에도 죽지 않는다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `config`
- 피호출(영향 전파 경로): `build_request`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
