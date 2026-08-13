---
type: function
title: open_excel_session
module: serve_b2b.py
lang: python
extraction: ast
signature: "(path, name=None, workbook_id=None, result_id=None, read_only_mirror=False, left=None, top=None, width=None, height=None, client_left=None, client_top=None, client_width=None, client_height=None, viewport_width=None, viewport_height=None, browser_title=None, native_parent_hwnd=None, native_host_hwnd=None, native_overlay=False, live_editable=False, defer_visible=False, from_state_sig=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:15104-15153"

# ── 입출력 ──
inputs:
  - "path"
  - "name"
  - "workbook_id"
  - "result_id"
  - "read_only_mirror"
  - "left"
  - "top"
  - "width"
  - "height"
  - "client_left"
  - "client_top"
  - "client_width"
  - "client_height"
  - "viewport_width"
  - "viewport_height"
  - "browser_title"
  - "native_parent_hwnd"
  - "native_host_hwnd"
  - "native_overlay"
  - "live_editable"
  - "defer_visible"
  - "from_state_sig"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_open_excel_session_impl"
  - "excel_call"
calls_external:
  - "browser_title"
  - "client_height"
  - "client_left"
  - "client_top"
  - "client_width"
  - "defer_visible"
  - "from_state_sig"
  - "height"
  - "left"
  - "live_editable"
  - "name"
  - "native_host_hwnd"
  - "native_overlay"
  - "native_parent_hwnd"
  - "path"
  - "read_only_mirror"
  - "result_id"
  - "top"
  - "viewport_height"
  - "viewport_width"
  - "width"
  - "workbook_id"
called_by:
  - "B2BHandler.handle_excel_open"
  - "B2BHandler.handle_excel_open_result"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_open_excel_session_impl`, `excel_call`
- 피호출(영향 전파 경로): `B2BHandler.handle_excel_open`, `B2BHandler.handle_excel_open_result`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
