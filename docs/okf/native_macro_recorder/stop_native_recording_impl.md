---
type: function
title: stop_native_recording_impl
module: native_macro_recorder.py
lang: python
extraction: ast
signature: "(app, baseline)"
role: "레코더 토글 OFF → 새로 생긴 매크로 모듈 추출·삭제 → 정제된 VBA 반환."
role_source: docstring
version: "0.8.1"
loc: "native_macro_recorder.py:458-581"

# ── 입출력 ──
inputs:
  - "app"
  - "baseline"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "상태 변경(전역/세션): RECORD_DIAG"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "_macro_recording_active"
  - "_touched_sheet_pairs"
  - "append"
  - "capture_expected_states"
  - "clear"
  - "extract_macro_body"
  - "raw"
  - "replace"
  - "rewrite_new_sheet_refs"
  - "sanitize_recorded_vba"
  - "summarize_vba_actions"
  - "wrap_as_b2b_skill"
calls_external:
  - "ExecuteMso"
  - "Lines"
  - "Remove"
  - "RuntimeError"
  - "_MACRO_RECORD_IDMSO"
  - "_q"
  - "app"
  - "b"
  - "base"
  - "code"
  - "combined"
  - "comp"
  - "count"
  - "harvested"
  - "harvested_sheets"
  - "int"
  - "join"
  - "len"
  - "list"
  - "lstrip"
  - "match"
  - "n"
  - "name"
  - "set"
  - "str"
  - "strip"
  - "tuple"
  - "wb_name"
  - "wb_sheet"
called_by:
  - "excel_record_stop"
reads:
  - "RECORD_DIAG"
  - "VBEXT_CT_STDMODULE"
  - "_MACRO_RECORD_IDMSO"
writes:
  - "RECORD_DIAG"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
레코더 토글 OFF → 새로 생긴 매크로 모듈 추출·삭제 → 정제된 VBA 반환.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 상태 변경(전역/세션): RECORD_DIAG
- 변경 상태 `RECORD_DIAG` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_macro_recording_active`, `_touched_sheet_pairs`, `append`, `capture_expected_states`, `clear`, `extract_macro_body`, `raw`, `replace`, `rewrite_new_sheet_refs`, `sanitize_recorded_vba`, `summarize_vba_actions`, `wrap_as_b2b_skill`
- 피호출(영향 전파 경로): `excel_record_stop`

## 실패/예외
- `RuntimeError`
