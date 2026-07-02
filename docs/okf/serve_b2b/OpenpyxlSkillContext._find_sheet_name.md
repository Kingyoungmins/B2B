---
type: method
title: OpenpyxlSkillContext._find_sheet_name
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlSkillContext
signature: "(self, wb, name=None, allow_single=True)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "serve_b2b.py:12985-13013"

# ── 입출력 ──
inputs:
  - "self"
  - "wb"
  - "name"
  - "allow_single"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_resolve_ephemeral_excel_open_sheet_alias"
  - "_unwrap_workbook"
  - "names"
  - "normalize"
  - "normalize_sheet_lookup"
calls_external:
  - "len"
  - "list"
  - "name"
  - "sheet_name"
  - "wb"
called_by:
  - "ExcelSkillContext.input_sheet"
  - "ExcelSkillContext.sheet"
  - "ExcelSkillContext.workbook_like"
  - "ExcelWorksheetsProxy.__call__"
  - "OpenpyxlSkillContext.input_sheet"
  - "OpenpyxlSkillContext.sheet"
  - "OpenpyxlSkillContext.workbook_like"
reads:
  - "self._unwrap_workbook"
  - "self.normalize"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_resolve_ephemeral_excel_open_sheet_alias`, `_unwrap_workbook`, `names`, `normalize`, `normalize_sheet_lookup`
- 피호출(영향 전파 경로): `ExcelSkillContext.input_sheet`, `ExcelSkillContext.sheet`, `ExcelSkillContext.workbook_like`, `ExcelWorksheetsProxy.__call__`, `OpenpyxlSkillContext.input_sheet`, `OpenpyxlSkillContext.sheet`, `OpenpyxlSkillContext.workbook_like`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
