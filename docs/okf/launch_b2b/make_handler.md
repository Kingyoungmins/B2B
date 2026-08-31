---
type: function
title: make_handler
module: launch_b2b.py
lang: python
extraction: ast
signature: "(lifecycle: BrowserLifecycle)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "launch_b2b.py:214-231"

# ── 입출력 ──
inputs:
  - "lifecycle: BrowserLifecycle"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "cleanup_excel_sessions"
  - "close"
  - "do_POST"
  - "end_headers"
  - "has_active_sessions"
  - "ping"
  - "read_session_id"
calls_external:
  - "BASE_DIR"
  - "LifecycleHandler"
  - "partial"
  - "self"
  - "send_response"
  - "str"
  - "super"
called_by:
  - "start_server"
reads:
  - "BASE_DIR"
  - "self.end_headers"
  - "self.path"
  - "self.send_response"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `cleanup_excel_sessions`, `close`, `do_POST`, `end_headers`, `has_active_sessions`, `ping`, `read_session_id`
- 피호출(영향 전파 경로): `start_server`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
