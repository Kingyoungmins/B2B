---
type: function
title: _record_button_label
module: native_macro_recorder.py
lang: python
extraction: ast
signature: "(app)"
role: "'매크로 기록' 리본 버튼의 현재 라벨. 못 읽으면 None."
role_source: docstring
version: "0.8.1"
loc: "native_macro_recorder.py:256-261"

# ── 입출력 ──
inputs:
  - "app"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "GetLabelMso"
  - "_MACRO_RECORD_IDMSO"
  - "str"
called_by:
  - "_macro_recording_active"
reads:
  - "_MACRO_RECORD_IDMSO"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
'매크로 기록' 리본 버튼의 현재 라벨. 못 읽으면 None.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_macro_recording_active`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
