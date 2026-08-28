---
type: function
title: show_control_window
module: launch_b2b.py
lang: python
extraction: ast
signature: "(url: str, on_close) -> None"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.1"
loc: "launch_b2b.py:253-288"

# ── 입출력 ──
inputs:
  - "url: str"
  - "on_close"
returns: "None"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Button"
  - "Frame"
  - "Label"
  - "Tk"
  - "askokcancel"
  - "button_frame"
  - "destroy"
  - "geometry"
  - "handle_close"
  - "mainloop"
  - "on_close"
  - "open"
  - "pack"
  - "protocol"
  - "resizable"
  - "root"
  - "sleep"
  - "title"
  - "url"
called_by:
  - "main"
reads:
  - "FONT"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `main`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
