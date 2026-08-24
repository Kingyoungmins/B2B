---
type: method
title: OpenpyxlSkillContext.filter_to_sheet
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlSkillContext
signature: "(self, sheet_or_name, predicate, dest_name, header_rows=1, workbook=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:17914-17950"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet_or_name"
  - "predicate"
  - "dest_name"
  - "header_rows"
  - "workbook"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_default_workbook"
  - "_write_grid"
  - "_ws_of"
  - "add_sheet"
  - "append"
  - "rows"
calls_external:
  - "body"
  - "callable"
  - "dest"
  - "dest_name"
  - "dest_wb"
  - "enumerate"
  - "getattr"
  - "header"
  - "int"
  - "k"
  - "len"
  - "list"
  - "max"
  - "predicate"
  - "r"
  - "report"
  - "self"
  - "sheet_or_name"
  - "total"
  - "workbook"
  - "ws"
called_by: []
reads:
  - "self._default_workbook"
  - "self._write_grid"
  - "self._ws_of"
  - "self.add_sheet"
  - "self.rows"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_default_workbook`, `_write_grid`, `_ws_of`, `add_sheet`, `append`, `rows`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
