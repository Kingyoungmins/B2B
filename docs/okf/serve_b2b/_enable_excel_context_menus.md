---
type: function
title: _enable_excel_context_menus
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app)"
role: "녹화 편집 모드: 우클릭(컨텍스트) 메뉴 복원 — 병합/셀 서식 진입 경로."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:3623-3636"

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
  - "Item"
  - "range"
calls_external:
  - "idx"
called_by:
  - "_present_live_session_frame"
  - "_set_live_sessions_edit_unlock"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
녹화 편집 모드: 우클릭(컨텍스트) 메뉴 복원 — 병합/셀 서식 진입 경로.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `Item`, `range`
- 피호출(영향 전파 경로): `_present_live_session_frame`, `_set_live_sessions_edit_unlock`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
