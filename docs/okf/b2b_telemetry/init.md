---
type: function
title: init
module: b2b_telemetry.py
lang: python
extraction: ast
signature: "(app_version='', writable_dir=None)"
role: "관측 로그 준비. 두 번 불러도 안전하다."
role_source: docstring
version: "0.8.2"
loc: "b2b_telemetry.py:126-155"

# ── 입출력 ──
inputs:
  - "app_version"
  - "writable_dir"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): _state"
raises: []

# ── 유기적 관계 ──
calls:
  - "_build_sender"
  - "_status_dict"
  - "_worker"
  - "shutdown"
  - "start"
calls_external:
  - "Path"
  - "Queue"
  - "Thread"
  - "cwd"
  - "register"
  - "str"
  - "writable_dir"
called_by:
  - "_addon_telemetry_init"
  - "_log_skill_run_impl"
reads:
  - "_PREVIEW_FILENAME"
  - "_lock"
  - "_state"
writes:
  - "_state"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
관측 로그 준비. 두 번 불러도 안전하다.

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): _state
- 변경 상태 `_state` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_build_sender`, `_status_dict`, `_worker`, `shutdown`, `start`
- 피호출(영향 전파 경로): `_addon_telemetry_init`, `_log_skill_run_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
