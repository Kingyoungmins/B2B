---
type: function
title: _session_for_workbook
module: serve_b2b.py
lang: python
extraction: ast
signature: "(wb, app=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:6838-6852"

# ── 입출력 ──
inputs:
  - "wb"
  - "app"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_same_excel_app"
  - "_workbook_fullname"
calls_external:
  - "app"
  - "get"
  - "items"
  - "list"
  - "session_app"
  - "session_wb"
  - "wb"
called_by:
  - "_active_session_for_app"
reads:
  - "EXCEL_SESSIONS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_same_excel_app`, `_workbook_fullname`
- 피호출(영향 전파 경로): `_active_session_for_app`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
