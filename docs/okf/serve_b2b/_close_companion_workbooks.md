---
type: function
title: _close_companion_workbooks
module: serve_b2b.py
lang: python
extraction: ast
signature: "(session, app)"
role: "이전에 동반 오픈한 워크북을 닫고 임시본 폴더를 정리한다(다음 스냅샷 전에 호출)."
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:9700-9719"

# ── 입출력 ──
inputs:
  - "session"
  - "app"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Close"
  - "cdir"
  - "get"
  - "list"
  - "lower"
  - "nm"
  - "rmtree"
  - "str"
called_by:
  - "_cleanup_excel_sessions_impl"
  - "_close_excel_session_impl"
  - "_ensure_companion_workbooks"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
이전에 동반 오픈한 워크북을 닫고 임시본 폴더를 정리한다(다음 스냅샷 전에 호출).

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 파일시스템 변경/IO

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_cleanup_excel_sessions_impl`, `_close_excel_session_impl`, `_ensure_companion_workbooks`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
