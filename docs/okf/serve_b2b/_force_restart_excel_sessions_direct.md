---
type: function
title: _force_restart_excel_sessions_direct
module: serve_b2b.py
lang: python
extraction: ast
signature: "(wait=False)"
role: "COM 큐를 '우회'하는 응급 복구. 공유 EXCEL.EXE 가 모달/행으로 굳으면 모든 excel_call 이"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:903-1025"

# ── 입출력 ──
inputs:
  - "wait"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
  - "상태 변경(전역/세션): LIVE_EXCEL_APP, PYTHON_SKILL_APP, PYTHON_SKILL_APP_LAST_USED, PYTHON_SKILL_APP_PID"
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_force_kill_pid"
  - "_is_pid_alive"
  - "_note_live_app_reset"
  - "_perf_trace"
  - "add"
  - "append"
  - "clear"
  - "values"
calls_external:
  - "LIVE_EXCEL_APP"
  - "PYTHON_SKILL_APP"
  - "PYTHON_SKILL_APP_PID"
  - "Path"
  - "Thread"
  - "_kill_and_cleanup"
  - "acquire"
  - "any"
  - "cdir"
  - "get"
  - "globals"
  - "int"
  - "key"
  - "len"
  - "list"
  - "p"
  - "pid"
  - "pids"
  - "release"
  - "rmtree"
  - "sessions"
  - "set"
  - "sleep"
  - "sorted"
  - "start"
  - "t"
  - "temp_path"
  - "time"
  - "unlink"
  - "update"
called_by:
  - "B2BHandler.do_POST"
  - "run_python_on_session"
reads:
  - "EXCEL_LOCK"
  - "EXCEL_SESSIONS"
  - "LIVE_EXCEL_APP"
  - "NATIVE_RECORDING"
  - "PIPELINE_JOBS"
  - "PIPELINE_JOBS_LOCK"
  - "PYTHON_SKILL_APP"
  - "PYTHON_SKILL_APP_PID"
  - "SPAWNED_EXCEL_PIDS"
  - "_COM_REF_GRAVEYARD"
  - "_KILL_INFLIGHT"
  - "_KILL_INFLIGHT_LOCK"
writes:
  - "LIVE_EXCEL_APP"
  - "PYTHON_SKILL_APP"
  - "PYTHON_SKILL_APP_LAST_USED"
  - "PYTHON_SKILL_APP_PID"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
COM 큐를 '우회'하는 응급 복구. 공유 EXCEL.EXE 가 모달/행으로 굳으면 모든 excel_call 이

## 사이드이펙트 & 주의
- EXCEL_LOCK 직렬화
- 상태 변경(전역/세션): LIVE_EXCEL_APP, PYTHON_SKILL_APP, PYTHON_SKILL_APP_LAST_USED, PYTHON_SKILL_APP_PID
- 파일시스템 변경/IO
- 변경 상태 `LIVE_EXCEL_APP, PYTHON_SKILL_APP, PYTHON_SKILL_APP_LAST_USED, PYTHON_SKILL_APP_PID` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_force_kill_pid`, `_is_pid_alive`, `_note_live_app_reset`, `_perf_trace`, `add`, `append`, `clear`, `values`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`, `run_python_on_session`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
