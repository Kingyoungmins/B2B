---
type: function
title: stop
module: log_sync.py
lang: python
extraction: ast
signature: "(reason='normal', timeout=6.0)"
role: "종료 직전 마지막 한 번 더 보내고 '이 세션 끝' 을 알린다(멱등)."
role_source: docstring
version: "0.8.2"
loc: "log_sync.py:576-609"

# ── 입출력 ──
inputs:
  - "reason"
  - "timeout"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): _STATE"
raises: []

# ── 유기적 관계 ──
calls:
  - "_note_fail"
  - "_note_ok"
  - "_now_iso"
  - "_post"
  - "config"
  - "status"
  - "tick"
calls_external:
  - "err"
  - "float"
  - "max"
  - "min"
  - "set"
  - "str"
  - "time"
  - "timeout"
called_by:
  - "PythonComSkillContext.copy_key_blocks"
  - "_atexit_stop"
  - "_log_sync_stop"
  - "excel_record_stop"
reads:
  - "_LOCK"
  - "_STATE"
  - "_WAKE"
writes:
  - "_STATE"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
종료 직전 마지막 한 번 더 보내고 '이 세션 끝' 을 알린다(멱등).

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): _STATE
- 변경 상태 `_STATE` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_note_fail`, `_note_ok`, `_now_iso`, `_post`, `config`, `status`, `tick`
- 피호출(영향 전파 경로): `PythonComSkillContext.copy_key_blocks`, `_atexit_stop`, `_log_sync_stop`, `excel_record_stop`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
