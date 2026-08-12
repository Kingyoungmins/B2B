---
type: method
title: ExcelSkillContext._default_workbook
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelSkillContext
signature: "(self)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:15645-15646"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
called_by:
  - "ExcelSkillContext.add_sheet"
  - "ExcelSkillContext.filter_to_sheet"
  - "ExcelSkillContext.pivot"
  - "ExcelSkillContext.sheet"
  - "OpenpyxlSkillContext.add_sheet"
  - "OpenpyxlSkillContext.filter_to_sheet"
  - "OpenpyxlSkillContext.pivot"
  - "OpenpyxlSkillContext.sheet"
reads:
  - "self.active_workbook"
  - "self.workbook"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `ExcelSkillContext.add_sheet`, `ExcelSkillContext.filter_to_sheet`, `ExcelSkillContext.pivot`, `ExcelSkillContext.sheet`, `OpenpyxlSkillContext.add_sheet`, `OpenpyxlSkillContext.filter_to_sheet`, `OpenpyxlSkillContext.pivot`, `OpenpyxlSkillContext.sheet`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
