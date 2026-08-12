---
type: function
title: _poll_excel_session_changes_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "(excel_id)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:14949-15085"

# ── 입출력 ──
inputs:
  - "excel_id"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "Worksheets"
  - "_active_session_for_app"
  - "_active_sheet_name"
  - "_active_sheet_snapshot"
  - "_excel_address"
  - "_excel_collection_names"
  - "_foreground_session_by_frame"
  - "_left_mouse_button_down"
  - "_maybe_snapshot_copy_source"
  - "append"
  - "get_excel_session"
  - "replace"
  - "session_workbook"
calls_external:
  - "Activate"
  - "RuntimeError"
  - "Windows"
  - "a"
  - "address"
  - "addresses"
  - "app"
  - "bool"
  - "changes"
  - "excel_id"
  - "frame_mode"
  - "get"
  - "int"
  - "keys"
  - "len"
  - "session"
  - "set"
  - "setdefault"
  - "sheet_name"
  - "sorted"
  - "wb"
called_by:
  - "poll_excel_session_changes"
reads:
  - "EXCEL_LOCK"
  - "LIVE_FRAME_MODE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- EXCEL_LOCK 직렬화
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Worksheets`, `_active_session_for_app`, `_active_sheet_name`, `_active_sheet_snapshot`, `_excel_address`, `_excel_collection_names`, `_foreground_session_by_frame`, `_left_mouse_button_down`, `_maybe_snapshot_copy_source`, `append`, `get_excel_session`, `replace`, `session_workbook`
- 피호출(영향 전파 경로): `poll_excel_session_changes`

## 실패/예외
- `RuntimeError`
