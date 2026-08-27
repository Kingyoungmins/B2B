---
type: function
title: _live_session_excel_ids_for_books
module: serve_b2b.py
lang: python
extraction: ast
signature: "(books, self_excel_id)"
role: "바뀐 워크북 이름 → 그게 어느 라이브 세션인지. 라이브(공유 앱) 경로용 —"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:10476-10495"

# ── 입출력 ──
inputs:
  - "books"
  - "self_excel_id"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
  - "normalize"
calls_external:
  - "Path"
  - "casefold"
  - "get"
  - "items"
  - "list"
  - "nm"
  - "oid"
  - "set"
  - "str"
called_by:
  - "_run_python_on_session_impl"
reads:
  - "EXCEL_SESSIONS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
바뀐 워크북 이름 → 그게 어느 라이브 세션인지. 라이브(공유 앱) 경로용 —

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`, `normalize`
- 피호출(영향 전파 경로): `_run_python_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
