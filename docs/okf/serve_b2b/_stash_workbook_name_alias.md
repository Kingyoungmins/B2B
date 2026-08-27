---
type: function
title: _stash_workbook_name_alias
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, intended_name, actual_name)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:8888-8906"

# ── 입출력 ──
inputs:
  - "app"
  - "intended_name"
  - "actual_name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_excel_process_id"
  - "_workbook_name_lookup_keys"
  - "add"
calls_external:
  - "Path"
  - "actual"
  - "app"
  - "int"
  - "intended"
  - "key"
  - "pid"
  - "set"
  - "setdefault"
  - "str"
called_by:
  - "excel_workbooks_open"
reads:
  - "_WB_NAME_ALIASES"
  - "_WB_NAME_REVERSE_ALIASES"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_excel_process_id`, `_workbook_name_lookup_keys`, `add`
- 피호출(영향 전파 경로): `excel_workbooks_open`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
