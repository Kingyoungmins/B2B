---
type: method
title: RecordService._run
module: record_service.py
lang: python
extraction: ast
class: RecordService
signature: "(self, app_stream)"
role: "---- 녹화 스레드 본체 ----"
role_source: banner
version: "0.8.2"
loc: "record_service.py:659-760"

# ── 입출력 ──
inputs:
  - "self"
  - "app_stream"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "상태 변경(전역/세션): self._error, self._handler, self._recording, self._result, self._sink"
raises: []

# ── 유기적 관계 ──
calls:
  - "_unmarshal_app"
  - "capture_expected_states"
  - "chunk_groups"
  - "consolidate_format_runs"
  - "consolidate_literal_runs"
  - "group_steps"
  - "group_to_pipeline_entry"
  - "merge_small_adjacent_groups"
calls_external:
  - "ActionSink"
  - "AppEvents"
  - "CoInitialize"
  - "CoUninitialize"
  - "CopySourceWatcher"
  - "GetActiveObject"
  - "PumpWaitingMessages"
  - "WithEvents"
  - "WorkbookRegistry"
  - "app"
  - "app_stream"
  - "begin"
  - "distill"
  - "enumerate"
  - "flush_dirty_formats"
  - "fn"
  - "format_exc"
  - "g"
  - "get"
  - "getattr"
  - "groups"
  - "handler"
  - "i"
  - "is_set"
  - "len"
  - "max"
  - "poll"
  - "reconcile"
  - "register"
  - "registry"
  - "set"
  - "sleep"
  - "sleep_s"
  - "steps"
  - "wb"
called_by: []
reads:
  - "self._lock"
  - "self._stop_evt"
writes:
  - "self._error"
  - "self._handler"
  - "self._recording"
  - "self._result"
  - "self._sink"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
---- 녹화 스레드 본체 ----

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 상태 변경(전역/세션): self._error, self._handler, self._recording, self._result, self._sink
- 변경 상태 `self._error, self._handler, self._recording, self._result, self._sink` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_unmarshal_app`, `capture_expected_states`, `chunk_groups`, `consolidate_format_runs`, `consolidate_literal_runs`, `group_steps`, `group_to_pipeline_entry`, `merge_small_adjacent_groups`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
