---
type: function
title: excel_record_start
module: serve_b2b.py
lang: python
extraction: ast
signature: "(engine='vba')"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:6600-6651"

# ── 입출력 ──
inputs:
  - "engine"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): NATIVE_RECORDING"
raises: []

# ── 유기적 관계 ──
calls:
  - "_commit_pending_excel_cell_edit"
  - "_get_live_excel_app"
  - "_set_live_sessions_edit_unlock"
  - "_vba_trace"
  - "clear"
  - "excel_call"
calls_external:
  - "RECORDING_EDIT_UNLOCKED"
  - "_marshal_live_app"
  - "_rd"
  - "_start_native"
  - "bool"
  - "dict"
  - "marshal_app_stream"
  - "start"
  - "start_native_recording_impl"
  - "stream"
called_by:
  - "B2BHandler.handle_excel_record_start"
reads:
  - "ALLOW_PYTHON_RECORD_ENGINE"
  - "NATIVE_RECORDING"
  - "RECORDING_EDIT_UNLOCKED"
writes:
  - "NATIVE_RECORDING"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): NATIVE_RECORDING
- 변경 상태 `NATIVE_RECORDING` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_commit_pending_excel_cell_edit`, `_get_live_excel_app`, `_set_live_sessions_edit_unlock`, `_vba_trace`, `clear`, `excel_call`
- 피호출(영향 전파 경로): `B2BHandler.handle_excel_record_start`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
