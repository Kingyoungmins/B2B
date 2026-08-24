---
type: method
title: OpenpyxlSkillContext.input_sheet
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlSkillContext
signature: "(self, sheet_hint=None, file_hint=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:17665-17675"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet_hint"
  - "file_hint"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "_find_sheet_name"
  - "_unwrap_workbook"
  - "append"
  - "values"
  - "workbook_like"
calls_external:
  - "OpenpyxlWorksheetProxy"
  - "RuntimeError"
  - "extend"
  - "file_hint"
  - "sheet_hint"
  - "wb"
called_by: []
reads:
  - "self._find_sheet_name"
  - "self._unwrap_workbook"
  - "self.inputs"
  - "self.workbook_like"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_find_sheet_name`, `_unwrap_workbook`, `append`, `values`, `workbook_like`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `RuntimeError`
