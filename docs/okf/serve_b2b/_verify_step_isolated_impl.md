---
type: function
title: _verify_step_isolated_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "(result_id, code, sheet_name=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:16091-16180"

# ── 입출력 ──
inputs:
  - "result_id"
  - "code"
  - "sheet_name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_excel_process_id"
  - "_exec_python_com_skill"
  - "_kill_pid_quiet"
  - "_protect_workbook_for_read_only_mirror"
  - "_track_spawned_excel_app"
  - "_vba_trace"
  - "_verify_capture_sheet_aoa"
  - "append"
  - "compute_workbook_diff"
  - "ensure_result_file"
calls_external:
  - "Close"
  - "DispatchEx"
  - "Open"
  - "Quit"
  - "VERIFY_TIMEOUT_S"
  - "after"
  - "app"
  - "before"
  - "bool"
  - "code"
  - "discard"
  - "err"
  - "get"
  - "int"
  - "items"
  - "len"
  - "path"
  - "perf_counter"
  - "pid"
  - "result_id"
  - "round"
  - "sample"
  - "search"
  - "session"
  - "sheet_name"
  - "str"
  - "strip"
  - "v"
  - "wb"
called_by:
  - "verify_step_isolated"
reads:
  - "EXCEL_LOCK"
  - "SPAWNED_EXCEL_PIDS"
  - "VERIFY_DIFF_CELL_CAP"
  - "VERIFY_TIMEOUT_S"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- EXCEL_LOCK 직렬화
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_excel_process_id`, `_exec_python_com_skill`, `_kill_pid_quiet`, `_protect_workbook_for_read_only_mirror`, `_track_spawned_excel_app`, `_vba_trace`, `_verify_capture_sheet_aoa`, `append`, `compute_workbook_diff`, `ensure_result_file`
- 피호출(영향 전파 경로): `verify_step_isolated`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
