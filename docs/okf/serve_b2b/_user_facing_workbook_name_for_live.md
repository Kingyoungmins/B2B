---
type: function
title: _user_facing_workbook_name_for_live
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, live_name)"
role: "라이브 wb.Name → 사용자 파일명(코드에 그대로 저장해도 되는 이름)."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:8277-8304"

# ── 입출력 ──
inputs:
  - "app"
  - "live_name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_excel_process_id"
calls_external:
  - "Path"
  - "app"
  - "bool"
  - "get"
  - "int"
  - "match"
  - "name"
  - "pid"
  - "stem"
  - "str"
  - "sub"
called_by:
  - "_capture_copypaste_on_session_impl"
reads:
  - "_GENERATED_WORKBOOK_PREFIX_RE"
  - "_WB_NAME_REVERSE_ALIASES"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
라이브 wb.Name → 사용자 파일명(코드에 그대로 저장해도 되는 이름).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_excel_process_id`
- 피호출(영향 전파 경로): `_capture_copypaste_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
