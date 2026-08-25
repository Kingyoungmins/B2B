---
type: function
title: _commit_pending_excel_cell_edit
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, max_wait_s=2.5)"
role: "[셀 편집 확정] 사용자가 셀 편집(in-cell edit) 중이면 Excel 이 COM 을 거부해"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:5515-5558"

# ── 입출력 ──
inputs:
  - "app"
  - "max_wait_s"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_excel_grid_hwnds_for_pid"
  - "_excel_process_id"
  - "_vba_trace"
calls_external:
  - "PostMessage"
  - "app"
  - "float"
  - "hwnd"
  - "max_wait_s"
  - "pid"
  - "sent"
  - "sleep"
  - "time"
called_by:
  - "excel_record_start"
  - "excel_record_stop"
reads:
  - "LIVE_EXCEL_APP_PID"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[셀 편집 확정] 사용자가 셀 편집(in-cell edit) 중이면 Excel 이 COM 을 거부해

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_excel_grid_hwnds_for_pid`, `_excel_process_id`, `_vba_trace`
- 피호출(영향 전파 경로): `excel_record_start`, `excel_record_stop`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
