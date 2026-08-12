---
type: function
title: _alias_open_workbook_name
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, requested_name)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:8174-8207"

# ── 입출력 ──
inputs:
  - "app"
  - "requested_name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_excel_process_id"
  - "_resolve_open_workbook_name"
  - "_workbook_name_lookup_keys"
  - "add"
calls_external:
  - "Path"
  - "app"
  - "get"
  - "int"
  - "key"
  - "len"
  - "open_actuals"
  - "pid"
  - "requested"
  - "requested_name"
  - "set"
  - "str"
  - "update"
called_by:
  - "PythonComSkillContext.book"
  - "_normalize_vba_workbook_literals"
reads:
  - "_WB_NAME_ALIASES"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_excel_process_id`, `_resolve_open_workbook_name`, `_workbook_name_lookup_keys`, `add`
- 피호출(영향 전파 경로): `PythonComSkillContext.book`, `_normalize_vba_workbook_literals`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
