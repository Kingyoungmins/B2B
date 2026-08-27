---
type: function
title: ensure_excel_worker
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:802-847"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): EXCEL_QUEUE, EXCEL_THREAD"
raises: []

# ── 유기적 관계 ──
calls:
  - "_cleanup_excel_sessions_impl"
  - "_maybe_quit_idle_python_skill_app"
  - "start"
calls_external:
  - "CoInitializeEx"
  - "CoUninitialize"
  - "PumpWaitingMessages"
  - "Queue"
  - "Thread"
  - "_rec_set_replaying"
  - "fn"
  - "get"
  - "is_alive"
  - "kwargs"
  - "put"
  - "worker"
called_by:
  - "excel_call"
reads:
  - "EXCEL_QUEUE"
  - "EXCEL_THREAD"
writes:
  - "EXCEL_QUEUE"
  - "EXCEL_THREAD"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): EXCEL_QUEUE, EXCEL_THREAD
- 변경 상태 `EXCEL_QUEUE, EXCEL_THREAD` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_cleanup_excel_sessions_impl`, `_maybe_quit_idle_python_skill_app`, `start`
- 피호출(영향 전파 경로): `excel_call`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
