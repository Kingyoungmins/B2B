---
type: function
title: _existing_macro_modules
module: native_macro_recorder.py
lang: python
extraction: ast
signature: "(app)"
role: "모든 열린 워크북의 (wb, component_name) 표준 모듈 스냅샷(시작 전 기준선)."
role_source: docstring
version: "0.8.2"
loc: "native_macro_recorder.py:243-253"

# ── 입출력 ──
inputs:
  - "app"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
calls_external:
  - "int"
  - "set"
  - "str"
called_by:
  - "start_native_recording_impl"
reads:
  - "VBEXT_CT_STDMODULE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
모든 열린 워크북의 (wb, component_name) 표준 모듈 스냅샷(시작 전 기준선).

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `add`
- 피호출(영향 전파 경로): `start_native_recording_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
