---
type: function
title: _log_sync_stop
module: serve_b2b.py
lang: python
extraction: ast
signature: "(reason='shutdown', timeout=4.0)"
role: "종료 직전 남은 로그를 마저 보내고 '이 세션 끝'을 알린다. 시작 안 했으면 아무것도 안 한다."
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:5048-5055"

# ── 입출력 ──
inputs:
  - "reason"
  - "timeout"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "get"
  - "reason"
  - "stop"
  - "timeout"
called_by:
  - "B2BHandler.do_POST"
  - "_native_parent_watch_once"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
종료 직전 남은 로그를 마저 보내고 '이 세션 끝'을 알린다. 시작 안 했으면 아무것도 안 한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `B2BHandler.do_POST`, `_native_parent_watch_once`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
