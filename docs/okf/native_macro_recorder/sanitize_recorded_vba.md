---
type: function
title: sanitize_recorded_vba
module: native_macro_recorder.py
lang: python
extraction: ast
signature: "(body: str) -> str"
role: "기록 VBA 의 재생 노이즈 제거 + Select/Selection 쌍 접합."
role_source: docstring
version: "0.8.2"
loc: "native_macro_recorder.py:108-147"

# ── 입출력 ──
inputs:
  - "body: str"
returns: "str"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_drop_dead_typing_lines"
  - "append"
calls_external:
  - "cur"
  - "extend"
  - "fused"
  - "group"
  - "join"
  - "l"
  - "len"
  - "lines"
  - "match"
  - "out"
  - "search"
  - "splitlines"
  - "str"
  - "strip"
  - "sub"
  - "text"
called_by:
  - "stop_native_recording_impl"
reads:
  - "_NOISE_LINE"
  - "_SELECTION_LINE"
  - "_SELECT_LINE"
  - "_SHEETY"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
기록 VBA 의 재생 노이즈 제거 + Select/Selection 쌍 접합.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_drop_dead_typing_lines`, `append`
- 피호출(영향 전파 경로): `stop_native_recording_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
