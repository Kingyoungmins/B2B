---
type: function
title: _addon_telemetry_stop
module: serve_b2b.py
lang: python
extraction: ast
signature: "(timeout=2.0)"
role: "os._exit 직전 남은 로그를 밀어낸다 — 그 경로에선 atexit 이 돌지 않는다(_log_sync_stop 과 같은 이유)."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:5556-5563"

# ── 입출력 ──
inputs:
  - "timeout"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "shutdown"
calls_external:
  - "get"
  - "hasattr"
  - "mod"
  - "timeout"
called_by:
  - "B2BHandler.do_POST"
  - "_native_parent_watch_once"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
os._exit 직전 남은 로그를 밀어낸다 — 그 경로에선 atexit 이 돌지 않는다(_log_sync_stop 과 같은 이유).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `shutdown`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`, `_native_parent_watch_once`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
