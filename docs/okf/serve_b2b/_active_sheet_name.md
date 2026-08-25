---
type: function
title: _active_sheet_name
module: serve_b2b.py
lang: python
extraction: ast
signature: "(wb, prefer_workbook=False)"
role: "활성 시트 '이름만' — 풀스냅샷 없이. 라이브 폴링 경량 경로용."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:15812-15833"

# ── 입출력 ──
inputs:
  - "wb"
  - "prefer_workbook"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_excel_collection_names"
  - "_workbook_fullname"
calls_external:
  - "str"
  - "wb"
called_by:
  - "_poll_excel_session_changes_impl"
  - "_read_excel_session_selection_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
활성 시트 '이름만' — 풀스냅샷 없이. 라이브 폴링 경량 경로용.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_excel_collection_names`, `_workbook_fullname`
- 피호출(영향 전파 경로): `_poll_excel_session_changes_impl`, `_read_excel_session_selection_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
