---
type: method
title: ExcelSkillContext.workbook_like
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelSkillContext
signature: "(self, hint=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.5"
loc: "serve_b2b.py:16392-16410"

# ── 입출력 ──
inputs:
  - "self"
  - "hint"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "_find_sheet_name"
  - "append"
  - "normalize"
  - "values"
calls_external:
  - "RuntimeError"
  - "hint"
  - "items"
  - "iter"
  - "len"
  - "name"
  - "next"
  - "wb"
called_by:
  - "ExcelSkillContext._workbook_for_file_id"
  - "ExcelSkillContext.input"
  - "ExcelSkillContext.input_sheet"
  - "OpenpyxlSkillContext._workbook_for_file_id"
  - "OpenpyxlSkillContext.input"
  - "OpenpyxlSkillContext.input_sheet"
reads:
  - "self._find_sheet_name"
  - "self.inputs"
  - "self.normalize"
  - "self.output_name"
  - "self.workbook"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_find_sheet_name`, `append`, `normalize`, `values`
- 피호출(영향 전파 경로): `ExcelSkillContext._workbook_for_file_id`, `ExcelSkillContext.input`, `ExcelSkillContext.input_sheet`, `OpenpyxlSkillContext._workbook_for_file_id`, `OpenpyxlSkillContext.input`, `OpenpyxlSkillContext.input_sheet`

## 실패/예외
- `RuntimeError`
