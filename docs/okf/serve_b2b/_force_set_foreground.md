---
type: function
title: _force_set_foreground
module: serve_b2b.py
lang: python
extraction: ast
signature: "(hwnd)"
role: "SetForegroundWindow + 실패 시 표준 우회(현재 포그라운드 스레드에 입력 큐 부착)."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:9309-9344"

# ── 입출력 ──
inputs:
  - "hwnd"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "AttachThreadInput"
  - "GetCurrentThreadId"
  - "GetForegroundWindow"
  - "GetWindowThreadProcessId"
  - "SetForegroundWindow"
  - "cur"
  - "cur_tid"
  - "hwnd"
  - "my_tid"
called_by:
  - "_restore_foreground_after_vba"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
SetForegroundWindow + 실패 시 표준 우회(현재 포그라운드 스레드에 입력 큐 부착).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_restore_foreground_after_vba`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
