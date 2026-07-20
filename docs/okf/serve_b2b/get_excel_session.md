---
type: function
title: get_excel_session
module: serve_b2b.py
lang: python
extraction: ast
signature: "(excel_id)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.19"
loc: "serve_b2b.py:4270-4275"

# ── 입출력 ──
inputs:
  - "excel_id"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls: []
calls_external:
  - "RuntimeError"
  - "excel_id"
  - "get"
called_by:
  - "_activate_excel_session_impl"
  - "_capture_copypaste_on_session_impl"
  - "_get_excel_hover_info_impl"
  - "_hide_excel_session_impl"
  - "_poll_excel_session_changes_impl"
  - "_position_excel_session_impl"
  - "_raise_excel_session_impl"
  - "_read_excel_session_selection_impl"
  - "_recover_excel_session_impl"
  - "_replace_excel_session_workbook_impl"
  - "_run_excel_python_pipeline_impl"
  - "_run_full_pipeline_single_instance_impl"
  - "_run_python_on_session_impl"
  - "_run_vba_on_session_impl"
  - "_run_vba_pipeline_on_session_impl"
  - "_save_excel_session_impl"
  - "_show_only_excel_session_impl"
reads:
  - "EXCEL_LOCK"
  - "EXCEL_SESSIONS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- EXCEL_LOCK 직렬화

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_activate_excel_session_impl`, `_capture_copypaste_on_session_impl`, `_get_excel_hover_info_impl`, `_hide_excel_session_impl`, `_poll_excel_session_changes_impl`, `_position_excel_session_impl`, `_raise_excel_session_impl`, `_read_excel_session_selection_impl`, `_recover_excel_session_impl`, `_replace_excel_session_workbook_impl`, `_run_excel_python_pipeline_impl`, `_run_full_pipeline_single_instance_impl`, `_run_python_on_session_impl`, `_run_vba_on_session_impl`, `_run_vba_pipeline_on_session_impl`, `_save_excel_session_impl`, `_show_only_excel_session_impl`

## 실패/예외
- `RuntimeError`
