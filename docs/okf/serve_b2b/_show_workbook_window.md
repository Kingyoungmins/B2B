---
type: function
title: _show_workbook_window
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, wb, activate=True)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:6488-6507"

# ── 입출력 ──
inputs:
  - "app"
  - "wb"
  - "activate"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_ensure_excel_workbook_view"
calls_external:
  - "Activate"
  - "Windows"
  - "activate"
  - "app"
  - "wb"
called_by:
  - "_recover_excel_session_impl"
  - "_show_only_excel_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_ensure_excel_workbook_view`
- 피호출(영향 전파 경로): `_recover_excel_session_impl`, `_show_only_excel_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
