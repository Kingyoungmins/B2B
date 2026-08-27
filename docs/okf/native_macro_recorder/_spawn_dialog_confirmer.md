---
type: function
title: _spawn_dialog_confirmer
module: native_macro_recorder.py
lang: python
extraction: ast
signature: "(app, timeout=8.0)"
role: "ExecuteMso('MacroRecord') 가 띄우는 모달 '매크로 기록' 다이얼로그를"
role_source: docstring
version: "0.8.0"
loc: "native_macro_recorder.py:275-347"

# ── 입출력 ──
inputs:
  - "app"
  - "timeout"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
  - "range"
  - "sort"
  - "start"
calls_external:
  - "EnumWindows"
  - "GetClassName"
  - "GetWindowThreadProcessId"
  - "IsWindowVisible"
  - "PostMessage"
  - "Thread"
  - "_cb"
  - "_find_dialog"
  - "_worker"
  - "h"
  - "int"
  - "main_hwnd"
  - "sleep"
  - "startswith"
  - "time"
called_by:
  - "start_native_recording_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
ExecuteMso('MacroRecord') 가 띄우는 모달 '매크로 기록' 다이얼로그를

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`, `range`, `sort`, `start`
- 피호출(영향 전파 경로): `start_native_recording_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
