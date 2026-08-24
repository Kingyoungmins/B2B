---
type: function
title: _run_python_on_session_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "(excel_id, code, skip_static=False, timeout_s=None)"
role: "라이브 세션에 떠 있는 실제 워크북에 Python COM 스킬을 실행한다(VBA 경로와 동일한 외피:"
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:14815-14876"

# ── 입출력 ──
inputs:
  - "excel_id"
  - "code"
  - "skip_static"
  - "timeout_s"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "_ensure_companion_workbooks"
  - "_exec_python_com_skill"
  - "_live_preview_schema"
  - "_live_session_excel_ids_for_books"
  - "_protect_workbook_for_read_only_mirror"
  - "_restore_app_state"
  - "_restore_live_protected_view"
  - "_restore_live_window"
  - "_vba_trace"
  - "get_excel_session"
  - "session_workbook"
calls_external:
  - "RuntimeError"
  - "app"
  - "code"
  - "code_hash"
  - "encode"
  - "excel_id"
  - "get"
  - "hexdigest"
  - "int"
  - "perf_counter"
  - "round"
  - "session"
  - "sha1"
  - "skip_static"
  - "strip"
  - "timeout_s"
  - "wb"
called_by:
  - "run_python_on_session"
reads:
  - "EXCEL_LOCK"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
라이브 세션에 떠 있는 실제 워크북에 Python COM 스킬을 실행한다(VBA 경로와 동일한 외피:

## 사이드이펙트 & 주의
- EXCEL_LOCK 직렬화

## 관계
- 호출: `_ensure_companion_workbooks`, `_exec_python_com_skill`, `_live_preview_schema`, `_live_session_excel_ids_for_books`, `_protect_workbook_for_read_only_mirror`, `_restore_app_state`, `_restore_live_protected_view`, `_restore_live_window`, `_vba_trace`, `get_excel_session`, `session_workbook`
- 피호출(영향 전파 경로): `run_python_on_session`

## 실패/예외
- `RuntimeError`
