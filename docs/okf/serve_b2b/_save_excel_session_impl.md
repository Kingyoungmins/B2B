---
type: function
title: _save_excel_session_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "(excel_id, name=None, internal=False)"
role: "워크북을 파일로 저장한다."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:5640-5767"

# ── 입출력 ──
inputs:
  - "excel_id"
  - "name"
  - "internal"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
  - "상태 변경(전역/세션): RESULTS"
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_configure_excel_grid_window"
  - "_configure_read_only_mirror_input_block"
  - "_disable_excel_context_menus"
  - "_promote_csv_multisheet_name"
  - "_protect_workbook_for_read_only_mirror"
  - "_vba_trace"
  - "get_excel_session"
  - "session_workbook"
calls_external:
  - "LinkSources"
  - "Path"
  - "SaveAs"
  - "SaveCopyAs"
  - "_attr"
  - "_ls"
  - "_save_link_n"
  - "_t_core"
  - "_t_restore"
  - "_t_unprotect"
  - "_val"
  - "app"
  - "bool"
  - "excel_id"
  - "get"
  - "internal"
  - "len"
  - "lower"
  - "mkdir"
  - "name"
  - "perf_counter"
  - "result_path"
  - "round"
  - "safe_name"
  - "session"
  - "setattr"
  - "str"
  - "time"
  - "uuid4"
  - "wb"
called_by:
  - "save_excel_session"
reads:
  - "BACKEND_DIR"
  - "EXCEL_LOCK"
  - "RESULTS"
writes:
  - "RESULTS"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
워크북을 파일로 저장한다.

## 사이드이펙트 & 주의
- EXCEL_LOCK 직렬화
- 상태 변경(전역/세션): RESULTS
- 파일시스템 변경/IO
- 변경 상태 `RESULTS` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_configure_excel_grid_window`, `_configure_read_only_mirror_input_block`, `_disable_excel_context_menus`, `_promote_csv_multisheet_name`, `_protect_workbook_for_read_only_mirror`, `_vba_trace`, `get_excel_session`, `session_workbook`
- 피호출(영향 전파 경로): `save_excel_session`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
