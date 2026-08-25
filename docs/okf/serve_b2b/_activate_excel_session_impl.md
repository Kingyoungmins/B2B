---
type: function
title: _activate_excel_session_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "(excel_id, sheet=None, address=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:6067-6142"

# ── 입출력 ──
inputs:
  - "excel_id"
  - "sheet"
  - "address"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "Range"
  - "Select"
  - "Worksheets"
  - "_ensure_excel_workbook_view"
  - "_excel_collection_names"
  - "_focus_excel_grid_child"
  - "_raise_excel_hwnd"
  - "_safe_activate_excel_app"
  - "_session_frame_hwnd"
  - "_show_window_na"
  - "get_excel_session"
  - "names"
  - "normalize_text"
  - "session_workbook"
  - "sheet"
calls_external:
  - "Activate"
  - "Goto"
  - "RuntimeError"
  - "Windows"
  - "address"
  - "app"
  - "err"
  - "excel_id"
  - "get"
  - "hwnd"
  - "len"
  - "match"
  - "name"
  - "next"
  - "session"
  - "str"
  - "target"
  - "wb"
called_by:
  - "activate_excel_session"
reads:
  - "EXCEL_LOCK"
  - "LIVE_FRAME_MODE"
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
- 호출: `Range`, `Select`, `Worksheets`, `_ensure_excel_workbook_view`, `_excel_collection_names`, `_focus_excel_grid_child`, `_raise_excel_hwnd`, `_safe_activate_excel_app`, `_session_frame_hwnd`, `_show_window_na`, `get_excel_session`, `names`, `normalize_text`, `session_workbook`, `sheet`
- 피호출(영향 전파 경로): `activate_excel_session`

## 실패/예외
- `RuntimeError`
