---
type: function
title: _reattach_live_excel_window
module: serve_b2b.py
lang: python
extraction: ast
signature: "(state)"
role: "_detach_live_excel_window 로 분리한 창을 원래 부모/owner/스타일로 되돌린다."
role_source: docstring
version: "0.5.18"
loc: "serve_b2b.py:7261-7284"

# ── 입출력 ──
inputs:
  - "state"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "SetParent"
  - "SetWindowLong"
  - "getattr"
  - "hwnd"
  - "owner_idx"
  - "prev_owner"
  - "prev_parent"
  - "prev_style"
  - "win32con"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
_detach_live_excel_window 로 분리한 창을 원래 부모/owner/스타일로 되돌린다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
