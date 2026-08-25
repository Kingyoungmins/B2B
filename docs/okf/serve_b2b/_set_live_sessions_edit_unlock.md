---
type: function
title: _set_live_sessions_edit_unlock
module: serve_b2b.py
lang: python
extraction: ast
signature: "(unlocked)"
role: "녹화 동안 라이브 엑셀뷰의 편집 잠금을 해제/원복한다(Excel 워커에서 실행)."
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:3583-3644"

# ── 입출력 ──
inputs:
  - "unlocked"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "상태 변경(전역/세션): RECORDING_EDIT_UNLOCKED"
raises: []

# ── 유기적 관계 ──
calls:
  - "_configure_read_only_mirror_input_block"
  - "_disable_excel_context_menus"
  - "_enable_excel_context_menus"
  - "_protect_workbook_for_read_only_mirror"
  - "_restore_excel_default_input"
  - "_set_excel_ribbon_visible"
  - "_show_excel_formula_bar"
  - "append"
  - "values"
calls_external:
  - "Activate"
  - "app"
  - "apps"
  - "bool"
  - "get"
  - "id"
  - "int"
  - "len"
  - "list"
  - "unlocked"
  - "wb"
called_by:
  - "excel_record_start"
  - "excel_record_stop"
reads:
  - "EXCEL_SESSIONS"
writes:
  - "RECORDING_EDIT_UNLOCKED"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
녹화 동안 라이브 엑셀뷰의 편집 잠금을 해제/원복한다(Excel 워커에서 실행).

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 상태 변경(전역/세션): RECORDING_EDIT_UNLOCKED
- 변경 상태 `RECORDING_EDIT_UNLOCKED` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_configure_read_only_mirror_input_block`, `_disable_excel_context_menus`, `_enable_excel_context_menus`, `_protect_workbook_for_read_only_mirror`, `_restore_excel_default_input`, `_set_excel_ribbon_visible`, `_show_excel_formula_bar`, `append`, `values`
- 피호출(영향 전파 경로): `excel_record_start`, `excel_record_stop`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
