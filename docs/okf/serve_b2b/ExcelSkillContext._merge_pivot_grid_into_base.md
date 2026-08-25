---
type: method
title: ExcelSkillContext._merge_pivot_grid_into_base
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelSkillContext
signature: "(self, workbook, dest_name, grid)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:17012-17063"

# ── 입출력 ──
inputs:
  - "self"
  - "workbook"
  - "dest_name"
  - "grid"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_write_grid"
  - "append"
  - "normalize"
  - "row"
  - "rows"
  - "sheet"
calls_external:
  - "any"
  - "base_header"
  - "base_name"
  - "base_sheet_name"
  - "base_ws"
  - "cur"
  - "endswith"
  - "enumerate"
  - "get"
  - "h"
  - "key"
  - "label"
  - "len"
  - "list"
  - "name"
  - "out"
  - "rsplit"
  - "src"
  - "str"
  - "workbook"
called_by:
  - "ExcelSkillContext.pivot"
  - "OpenpyxlSkillContext.pivot"
reads:
  - "self._write_grid"
  - "self.normalize"
  - "self.rows"
  - "self.sheet"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_write_grid`, `append`, `normalize`, `row`, `rows`, `sheet`
- 피호출(영향 전파 경로): `ExcelSkillContext.pivot`, `OpenpyxlSkillContext.pivot`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
