---
type: function
title: _active_sheet_snapshot
module: serve_b2b.py
lang: python
extraction: ast
signature: "(wb, prefer_workbook=False)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:14885-14907"

# ── 입출력 ──
inputs:
  - "wb"
  - "prefer_workbook"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "Worksheets"
  - "_excel_collection_names"
  - "_sheet_snapshot"
  - "_workbook_fullname"
calls_external:
  - "Activate"
  - "RuntimeError"
  - "wb"
  - "ws"
called_by:
  - "_poll_excel_session_changes_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Worksheets`, `_excel_collection_names`, `_sheet_snapshot`, `_workbook_fullname`
- 피호출(영향 전파 경로): `_poll_excel_session_changes_impl`

## 실패/예외
- `RuntimeError`
