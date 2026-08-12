---
type: method
title: ExcelSkillContext.input_sheet
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelSkillContext
signature: "(self, sheet_hint=None, file_hint=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:15596-15606"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet_hint"
  - "file_hint"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "Worksheets"
  - "_find_sheet_name"
  - "append"
  - "values"
  - "workbook_like"
calls_external:
  - "RuntimeError"
  - "extend"
  - "file_hint"
  - "sheet_hint"
  - "sheet_name"
  - "wb"
called_by: []
reads:
  - "self._find_sheet_name"
  - "self.inputs"
  - "self.workbook_like"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Worksheets`, `_find_sheet_name`, `append`, `values`, `workbook_like`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `RuntimeError`
