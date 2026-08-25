---
type: function
title: _read_excel_session_selection_impl
module: serve_b2b.py
lang: python
extraction: ast
signature: "(excel_id)"
role: "[0.5.17] 현재 탭의 선택(Selection)만 가볍게 읽는다 — active-sync(포그라운드/탭 따라가기)·복사소스"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:16027-16048"

# ── 입출력 ──
inputs:
  - "excel_id"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "EXCEL_LOCK 직렬화"
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_active_sheet_name"
  - "_excel_address"
  - "get_excel_session"
  - "replace"
  - "session_workbook"
calls_external:
  - "Windows"
  - "bool"
  - "excel_id"
  - "frame_mode"
  - "get"
  - "session"
  - "wb"
called_by:
  - "poll_excel_session_selection"
reads:
  - "EXCEL_LOCK"
  - "LIVE_FRAME_MODE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[0.5.17] 현재 탭의 선택(Selection)만 가볍게 읽는다 — active-sync(포그라운드/탭 따라가기)·복사소스

## 사이드이펙트 & 주의
- EXCEL_LOCK 직렬화
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_active_sheet_name`, `_excel_address`, `get_excel_session`, `replace`, `session_workbook`
- 피호출(영향 전파 경로): `poll_excel_session_selection`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
