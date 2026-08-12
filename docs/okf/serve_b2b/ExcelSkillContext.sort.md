---
type: method
title: ExcelSkillContext.sort
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelSkillContext
signature: "(self, sheet_or_name, by, ascending=True, header=True, workbook=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:16012-16049"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet_or_name"
  - "by"
  - "ascending"
  - "header"
  - "workbook"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "상태 변경(전역/세션): self.last_output_sheet"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "Columns"
  - "_col0"
  - "_is_output_workbook"
  - "_ws_of"
  - "append"
  - "rows"
calls_external:
  - "Add"
  - "Apply"
  - "Calculate"
  - "Clear"
  - "RuntimeError"
  - "SetRange"
  - "asc_list"
  - "ascending"
  - "bool"
  - "by"
  - "enumerate"
  - "int"
  - "isinstance"
  - "k"
  - "keys"
  - "kr"
  - "len"
  - "list"
  - "rel"
  - "rels"
  - "sheet_or_name"
  - "used"
  - "workbook"
  - "ws"
called_by:
  - "PythonComSkillContext.match_fill"
  - "_browser_content_target"
reads:
  - "self._col0"
  - "self._is_output_workbook"
  - "self._ws_of"
  - "self.rows"
writes:
  - "self.last_output_sheet"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 상태 변경(전역/세션): self.last_output_sheet
- 변경 상태 `self.last_output_sheet` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `Columns`, `_col0`, `_is_output_workbook`, `_ws_of`, `append`, `rows`
- 피호출(영향 전파 경로): `PythonComSkillContext.match_fill`, `_browser_content_target`

## 실패/예외
- `RuntimeError`
