---
type: function
title: _macro_recording_active
module: native_macro_recorder.py
lang: python
extraction: ast
signature: "(app)"
role: "매크로 기록 중인지 — 'MacroRecord' 버튼 라벨이 '기록 중지'로 바뀌었는지로 판정."
role_source: docstring
version: "0.8.0"
loc: "native_macro_recorder.py:264-272"

# ── 입출력 ──
inputs:
  - "app"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_record_button_label"
calls_external:
  - "any"
  - "app"
  - "lower"
called_by:
  - "start_native_recording_impl"
  - "stop_native_recording_impl"
reads:
  - "_RECORDING_LABEL_HINTS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
매크로 기록 중인지 — 'MacroRecord' 버튼 라벨이 '기록 중지'로 바뀌었는지로 판정.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_record_button_label`
- 피호출(영향 전파 경로): `start_native_recording_impl`, `stop_native_recording_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
