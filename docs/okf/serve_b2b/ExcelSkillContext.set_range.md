---
type: method
title: ExcelSkillContext.set_range
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelSkillContext
signature: "(self, sheet_or_name, address, grid, workbook=None)"
role: "주소(예 'A2' 또는 'A2:F100')의 좌상단부터 2D 리스트를 한 번에 쓴다(1회 COM 호출)."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:17640-17657"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet_or_name"
  - "address"
  - "grid"
  - "workbook"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "상태 변경(전역/세션): self.last_output_address, self.last_output_sheet"
raises: []

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "Range"
  - "_apply_com_text_format_for_long_digit_columns"
  - "_is_output_workbook"
  - "_ws_of"
calls_external:
  - "address"
  - "c0"
  - "int"
  - "len"
  - "list"
  - "max"
  - "norm"
  - "r0"
  - "sheet_or_name"
  - "str"
  - "workbook"
  - "ws"
called_by: []
reads:
  - "self._is_output_workbook"
  - "self._ws_of"
writes:
  - "self.last_output_address"
  - "self.last_output_sheet"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
주소(예 'A2' 또는 'A2:F100')의 좌상단부터 2D 리스트를 한 번에 쓴다(1회 COM 호출).

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 상태 변경(전역/세션): self.last_output_address, self.last_output_sheet
- 변경 상태 `self.last_output_address, self.last_output_sheet` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `Cells`, `Range`, `_apply_com_text_format_for_long_digit_columns`, `_is_output_workbook`, `_ws_of`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
