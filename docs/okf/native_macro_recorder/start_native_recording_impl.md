---
type: function
title: start_native_recording_impl
module: native_macro_recorder.py
lang: python
extraction: ast
signature: "(app)"
role: "레코더 토글 ON. 반환: 시작 전 모듈 기준선(정지 시 새 모듈 식별용)."
role_source: docstring
version: "0.8.1"
loc: "native_macro_recorder.py:381-424"

# ── 입출력 ──
inputs:
  - "app"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): RECORD_DIAG"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "_existing_macro_modules"
  - "_macro_recording_active"
  - "_read_numlock_state"
  - "_restore_numlock_state"
  - "_spawn_dialog_confirmer"
  - "clear"
calls_external:
  - "ExecuteMso"
  - "RuntimeError"
  - "_MACRO_RECORD_IDMSO"
  - "_MACRO_RELATIVE_IDMSO"
  - "_numlock_before"
  - "app"
  - "baseline"
  - "bool"
  - "len"
  - "sorted"
called_by:
  - "excel_record_start"
reads:
  - "RECORD_DIAG"
  - "_MACRO_RECORD_IDMSO"
  - "_MACRO_RELATIVE_IDMSO"
writes:
  - "RECORD_DIAG"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
레코더 토글 ON. 반환: 시작 전 모듈 기준선(정지 시 새 모듈 식별용).

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): RECORD_DIAG
- 변경 상태 `RECORD_DIAG` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_existing_macro_modules`, `_macro_recording_active`, `_read_numlock_state`, `_restore_numlock_state`, `_spawn_dialog_confirmer`, `clear`
- 피호출(영향 전파 경로): `excel_record_start`

## 실패/예외
- `RuntimeError`
