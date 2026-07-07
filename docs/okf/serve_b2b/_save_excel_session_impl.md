---
type: function
title: _save_excel_session_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "(excel_id, name=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.19"
loc: "serve_b2b.py:4382-4469"

# ── 입출력 ──
inputs:
  - "excel_id"
  - "name"
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
  - "_val"
  - "app"
  - "bool"
  - "excel_id"
  - "get"
  - "len"
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
timestamp: "0.5.19-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- EXCEL_LOCK 직렬화
- 상태 변경(전역/세션): RESULTS
- 파일시스템 변경/IO
- 변경 상태 `RESULTS` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_configure_excel_grid_window`, `_configure_read_only_mirror_input_block`, `_disable_excel_context_menus`, `_protect_workbook_for_read_only_mirror`, `_vba_trace`, `get_excel_session`, `session_workbook`
- 피호출(영향 전파 경로): `save_excel_session`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
