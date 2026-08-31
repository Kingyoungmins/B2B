---
type: function
title: main
module: launch_b2b.py
lang: python
extraction: ast
signature: "() -> int"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "launch_b2b.py:291-347"

# ── 입출력 ──
inputs: []
returns: "int"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "app_url"
  - "append"
  - "candidate_ports"
  - "check_for_update"
  - "cleanup_backend_runtime_files"
  - "cleanup_excel_sessions"
  - "cleanup_node_worker"
  - "is_port_available"
  - "show_control_window"
  - "shutdown"
  - "start_lifecycle_monitor"
  - "start_runtime_maintenance_threads"
  - "start_server"
  - "wait_for_server"
calls_external:
  - "BrowserLifecycle"
  - "Event"
  - "SERVER_HOST"
  - "bool"
  - "errors"
  - "exists"
  - "get"
  - "join"
  - "lifecycle"
  - "open"
  - "port"
  - "print"
  - "selected_port"
  - "server_close"
  - "set"
  - "shutdown_event"
  - "str"
  - "strip"
  - "url"
  - "wait"
called_by: []
reads:
  - "BASE_DIR"
  - "SERVER_HOST"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `app_url`, `append`, `candidate_ports`, `check_for_update`, `cleanup_backend_runtime_files`, `cleanup_excel_sessions`, `cleanup_node_worker`, `is_port_available`, `show_control_window`, `shutdown`, `start_lifecycle_monitor`, `start_runtime_maintenance_threads`, `start_server`, `wait_for_server`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
