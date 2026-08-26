---
type: function
title: _ensure_companion_workbooks
module: serve_b2b.py
lang: python
extraction: ast
signature: "(session, excel_id, app, current_wb)"
role: "다른 라이브 세션들의 '현재(편집 반영된) 상태'를 스냅샷해서 이 인스턴스에 읽기전용으로 동반 오픈한다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:9810-9913"

# ── 입출력 ──
inputs:
  - "session"
  - "excel_id"
  - "app"
  - "current_wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_close_companion_workbooks"
  - "_hide_non_target_workbook_windows"
  - "_hide_workbook_windows"
  - "_is_live_shared_app"
  - "add"
  - "append"
  - "excel_workbooks_open"
  - "session_workbook"
calls_external:
  - "Activate"
  - "Path"
  - "SaveCopyAs"
  - "_o_app"
  - "all"
  - "app"
  - "bool"
  - "cdir"
  - "clean"
  - "cpath"
  - "current_wb"
  - "exists"
  - "get"
  - "int"
  - "items"
  - "list"
  - "lower"
  - "mkdir"
  - "nm"
  - "other"
  - "rmtree"
  - "session"
  - "set"
  - "str"
  - "t"
  - "uuid4"
  - "wb2"
called_by:
  - "_run_python_on_session_impl"
  - "_run_vba_on_session_impl"
reads:
  - "BACKEND_DIR"
  - "EXCEL_SESSIONS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
다른 라이브 세션들의 '현재(편집 반영된) 상태'를 스냅샷해서 이 인스턴스에 읽기전용으로 동반 오픈한다.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 파일시스템 변경/IO

## 관계
- 호출: `_close_companion_workbooks`, `_hide_non_target_workbook_windows`, `_hide_workbook_windows`, `_is_live_shared_app`, `add`, `append`, `excel_workbooks_open`, `session_workbook`
- 피호출(영향 전파 경로): `_run_python_on_session_impl`, `_run_vba_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
