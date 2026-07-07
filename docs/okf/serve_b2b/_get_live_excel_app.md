---
type: function
title: _get_live_excel_app
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "라이브 편집 워크북을 한 Excel 프로세스 안에 모으기 위한 앱 전용 Excel.Application."
role_source: docstring
version: "0.5.19"
loc: "serve_b2b.py:3874-3903"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "상태 변경(전역/세션): LIVE_EXCEL_APP"
raises: []

# ── 유기적 관계 ──
calls:
  - "_ensure_vbom_access"
  - "_track_spawned_excel_app"
  - "value"
calls_external:
  - "DispatchEx"
  - "app"
  - "attr"
  - "setattr"
called_by:
  - "_open_excel_session_impl"
  - "_reopen_excel_session_workbook"
reads:
  - "LIVE_EXCEL_APP"
writes:
  - "LIVE_EXCEL_APP"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
라이브 편집 워크북을 한 Excel 프로세스 안에 모으기 위한 앱 전용 Excel.Application.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 상태 변경(전역/세션): LIVE_EXCEL_APP
- 변경 상태 `LIVE_EXCEL_APP` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_ensure_vbom_access`, `_track_spawned_excel_app`, `value`
- 피호출(영향 전파 경로): `_open_excel_session_impl`, `_reopen_excel_session_workbook`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
