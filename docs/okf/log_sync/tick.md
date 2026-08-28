---
type: function
title: tick
module: log_sync.py
lang: python
extraction: ast
signature: "(timeout=15.0, wait_running=0.0, deadline=None)"
role: "한 번 전송. 스레드에서도, 종료 직전에도 같은 함수를 쓴다."
role_source: docstring
version: "0.8.1"
loc: "log_sync.py:462-505"

# ── 입출력 ──
inputs:
  - "timeout"
  - "wait_running"
  - "deadline"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): _STATE"
raises: []

# ── 유기적 관계 ──
calls:
  - "_ensure_session"
  - "_ensure_user"
  - "_note_fail"
  - "_over_total_budget"
  - "_send_log_file"
  - "_send_skill"
  - "_session_files"
  - "_session_skills"
  - "config"
calls_external:
  - "_gen"
  - "deadline"
  - "err"
  - "float"
  - "get"
  - "int"
  - "max"
  - "path"
  - "sleep"
  - "time"
  - "timeout"
called_by:
  - "_loop"
  - "stop"
reads:
  - "_LOCK"
  - "_STATE"
writes:
  - "_STATE"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
한 번 전송. 스레드에서도, 종료 직전에도 같은 함수를 쓴다.

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): _STATE
- 변경 상태 `_STATE` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_ensure_session`, `_ensure_user`, `_note_fail`, `_over_total_budget`, `_send_log_file`, `_send_skill`, `_session_files`, `_session_skills`, `config`
- 피호출(영향 전파 경로): `_loop`, `stop`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
