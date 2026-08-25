---
type: function
title: _sync_modified_companions_into_live
module: serve_b2b.py
lang: python
extraction: ast
signature: "(companions, excel_id, fpid, work, mutated_books=None, mutation_tracked=False)"
role: "격리 인스턴스에서 '대상(ftarget)'이 아닌 동반 워크북이 변형됐으면(Saved=False),"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:10238-10306"

# ── 입출력 ──
inputs:
  - "companions"
  - "excel_id"
  - "fpid"
  - "work"
  - "mutated_books"
  - "mutation_tracked"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_copy_source_workbook_into_target"
  - "_protect_workbook_for_read_only_mirror"
  - "_restore_live_window"
  - "_vba_trace"
  - "normalize"
  - "session_workbook"
calls_external:
  - "Path"
  - "SaveCopyAs"
  - "bool"
  - "casefold"
  - "cname"
  - "err"
  - "excel_id"
  - "fpid"
  - "get"
  - "int"
  - "mkdir"
  - "n"
  - "oapp"
  - "oid"
  - "other"
  - "owb"
  - "set"
  - "spath"
  - "str"
  - "uuid4"
  - "work"
called_by:
  - "_run_vba_pipeline_on_session_impl"
reads:
  - "EXCEL_SESSIONS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
격리 인스턴스에서 '대상(ftarget)'이 아닌 동반 워크북이 변형됐으면(Saved=False),

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_copy_source_workbook_into_target`, `_protect_workbook_for_read_only_mirror`, `_restore_live_window`, `_vba_trace`, `normalize`, `session_workbook`
- 피호출(영향 전파 경로): `_run_vba_pipeline_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
