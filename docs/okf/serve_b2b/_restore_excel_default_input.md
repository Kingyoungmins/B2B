---
type: function
title: _restore_excel_default_input
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app)"
role: "녹화 편집 모드: 미러 입력 차단 원복(셀 내 편집 + 기본 키 동작)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:3517-3527"

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
  - "OnKey"
  - "key"
called_by:
  - "_present_live_session_frame"
  - "_set_live_sessions_edit_unlock"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
녹화 편집 모드: 미러 입력 차단 원복(셀 내 편집 + 기본 키 동작).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_present_live_session_frame`, `_set_live_sessions_edit_unlock`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
