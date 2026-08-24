---
type: function
title: _hide_non_target_workbook_windows
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, target_wb)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.5"
loc: "serve_b2b.py:19121-19130"

# ── 입출력 ──
inputs:
  - "app"
  - "target_wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_hide_workbook_windows"
  - "_workbook_identity"
calls_external:
  - "list"
  - "target_wb"
  - "wb"
called_by:
  - "_ensure_companion_workbooks"
  - "_restore_live_window"
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
- 호출: `_hide_workbook_windows`, `_workbook_identity`
- 피호출(영향 전파 경로): `_ensure_companion_workbooks`, `_restore_live_window`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
