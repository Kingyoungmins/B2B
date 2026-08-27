---
type: function
title: _read_numlock_state
module: native_macro_recorder.py
lang: python
extraction: ast
signature: "()"
role: "[NumLock 보존] Application.SendKeys 는 호출 자체가 NumLock 을 꺼버리는 고질 버그가 있다"
role_source: banner
version: "0.8.0"
loc: "native_macro_recorder.py:353-358"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "GetKeyState"
  - "bool"
called_by:
  - "start_native_recording_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[NumLock 보존] Application.SendKeys 는 호출 자체가 NumLock 을 꺼버리는 고질 버그가 있다

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `start_native_recording_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
