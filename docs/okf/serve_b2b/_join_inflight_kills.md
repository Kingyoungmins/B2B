---
type: function
title: _join_inflight_kills
module: serve_b2b.py
lang: python
extraction: ast
signature: "(timeout)"
role: "진행 중인 비동기 force-restart kill 스레드를 기다린다(종료 경로 전용)."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:1027-1042"

# ── 입출력 ──
inputs:
  - "timeout"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): _KILL_INFLIGHT"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "float"
  - "is_alive"
  - "join"
  - "max"
  - "remain"
  - "time"
called_by:
  - "B2BHandler.do_POST"
reads:
  - "_KILL_INFLIGHT"
  - "_KILL_INFLIGHT_LOCK"
writes:
  - "_KILL_INFLIGHT"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
진행 중인 비동기 force-restart kill 스레드를 기다린다(종료 경로 전용).

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): _KILL_INFLIGHT
- 변경 상태 `_KILL_INFLIGHT` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `B2BHandler.do_POST`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
