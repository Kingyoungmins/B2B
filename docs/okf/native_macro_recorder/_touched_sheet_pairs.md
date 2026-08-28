---
type: function
title: _touched_sheet_pairs
module: native_macro_recorder.py
lang: python
extraction: ast
signature: "(harvested, harvested_sheets)"
role: "녹화 청크에서 (워크북명, 시트명) 터치 집합 도출 — 재현 검증(expected) 수확용."
role_source: docstring
version: "0.8.1"
loc: "native_macro_recorder.py:427-455"

# ── 입출력 ──
inputs:
  - "harvested"
  - "harvested_sheets"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "append"
  - "book"
calls_external:
  - "_add"
  - "enumerate"
  - "finditer"
  - "get"
  - "group"
  - "harvested"
  - "harvested_sheets"
  - "item"
  - "key"
  - "len"
  - "set"
  - "wb_name"
called_by:
  - "stop_native_recording_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
녹화 청크에서 (워크북명, 시트명) 터치 집합 도출 — 재현 검증(expected) 수확용.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `append`, `book`
- 피호출(영향 전파 경로): `stop_native_recording_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
