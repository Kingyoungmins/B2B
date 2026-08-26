---
type: function
title: _style_live_overlay_window
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app)"
role: "라이브 창을 프레임리스(제목줄/테두리/최소·최대화 버튼 제거)로 만든다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:4582-4610"

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
  - "GetWindowLong"
  - "SetWindowLong"
  - "desired"
  - "desired_ex"
  - "getattr"
  - "hwnd"
  - "int"
  - "win32con"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
라이브 창을 프레임리스(제목줄/테두리/최소·최대화 버튼 제거)로 만든다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
