---
type: function
title: capture_expected_states
module: record_service.py
lang: python
extraction: ast
signature: "(app, touched)"
role: "touched {(book_key, sheet)} 시트들의 정지 시점 기대 상태 목록(재현 검증용)."
role_source: docstring
version: "0.8.1"
loc: "record_service.py:152-178"

# ── 입출력 ──
inputs:
  - "app"
  - "touched"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "append"
  - "sheet_expected_state"
calls_external:
  - "base"
  - "basename_of"
  - "bk"
  - "get"
  - "set"
  - "setdefault"
  - "sh"
  - "st"
  - "str"
  - "ws"
called_by:
  - "RecordService._run"
  - "stop_native_recording_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
touched {(book_key, sheet)} 시트들의 정지 시점 기대 상태 목록(재현 검증용).

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `add`, `append`, `sheet_expected_state`
- 피호출(영향 전파 경로): `RecordService._run`, `stop_native_recording_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
