---
type: method
title: OpenpyxlSkillContext._unwrap_workbook
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlSkillContext
signature: "(self, wb)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:17384-17385"

# ── 입출력 ──
inputs:
  - "self"
  - "wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "OpenpyxlWorkbookProxy"
  - "isinstance"
  - "wb"
called_by:
  - "ExcelSkillContext._find_sheet_name"
  - "ExcelSkillContext._is_output_workbook"
  - "ExcelSkillContext.add_sheet"
  - "ExcelSkillContext.sheet"
  - "OpenpyxlSkillContext.__init__"
  - "OpenpyxlSkillContext._find_sheet_name"
  - "OpenpyxlSkillContext._is_output_workbook"
  - "OpenpyxlSkillContext._sheet_add_target"
  - "OpenpyxlSkillContext._sheet_names"
  - "OpenpyxlSkillContext.add_sheet"
  - "OpenpyxlSkillContext.flush_pending_rows"
  - "OpenpyxlSkillContext.input_sheet"
  - "OpenpyxlSkillContext.sheet"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `ExcelSkillContext._find_sheet_name`, `ExcelSkillContext._is_output_workbook`, `ExcelSkillContext.add_sheet`, `ExcelSkillContext.sheet`, `OpenpyxlSkillContext.__init__`, `OpenpyxlSkillContext._find_sheet_name`, `OpenpyxlSkillContext._is_output_workbook`, `OpenpyxlSkillContext._sheet_add_target`, `OpenpyxlSkillContext._sheet_names`, `OpenpyxlSkillContext.add_sheet`, `OpenpyxlSkillContext.flush_pending_rows`, `OpenpyxlSkillContext.input_sheet`, `OpenpyxlSkillContext.sheet`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
