---
type: function
title: _foreground_session_by_frame
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "포그라운드 창이 우리 라이브 세션 프레임이면 그 세션을 반환."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:7012-7034"

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
  - "GetForegroundWindow"
  - "get"
  - "int"
  - "items"
  - "list"
called_by:
  - "_poll_excel_session_changes_impl"
reads:
  - "EXCEL_SESSIONS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
포그라운드 창이 우리 라이브 세션 프레임이면 그 세션을 반환.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_poll_excel_session_changes_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
