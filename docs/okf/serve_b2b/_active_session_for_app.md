---
type: function
title: _active_session_for_app
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, fallback_session=None, fallback_wb=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.5"
loc: "serve_b2b.py:6767-6777"

# ── 입출력 ──
inputs:
  - "app"
  - "fallback_session"
  - "fallback_wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_session_for_workbook"
calls_external:
  - "active_wb"
  - "app"
  - "get"
called_by:
  - "_poll_excel_session_changes_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_session_for_workbook`
- 피호출(영향 전파 경로): `_poll_excel_session_changes_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
