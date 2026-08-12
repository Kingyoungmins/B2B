---
type: method
title: OpenpyxlSkillContext.__init__
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlSkillContext
signature: "(self, output_wb, input_wbs, output_cached_wb=None, output_name=None, active_file_id=None, active_sheet=None, output_cached_path=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:16691-16711"

# ── 입출력 ──
inputs:
  - "self"
  - "output_wb"
  - "input_wbs"
  - "output_cached_wb"
  - "output_name"
  - "active_file_id"
  - "active_sheet"
  - "output_cached_path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): self._dirty_workbook_ids, self._last_sheet_workbook_raw, self._output_cached_path, self._output_cached_tried, self._output_cached_wb, self._progress, self._workbook, self.active_file_id, self.active_sheet_name, self.active_workbook, self.excel, self.inputs, self.last_output_address, self.last_output_sheet, self.output, self.output_name, self.workbook"
raises: []

# ── 유기적 관계 ──
calls:
  - "_unwrap_workbook"
  - "_workbook_for_file_id"
calls_external:
  - "OpenpyxlWorkbookProxy"
  - "items"
  - "name"
  - "output_wb"
  - "self"
  - "set"
  - "str"
  - "wb"
called_by: []
reads:
  - "self._unwrap_workbook"
  - "self._workbook_for_file_id"
  - "self.active_file_id"
  - "self.active_workbook"
  - "self.output_name"
  - "self.workbook"
writes:
  - "self._dirty_workbook_ids"
  - "self._last_sheet_workbook_raw"
  - "self._output_cached_path"
  - "self._output_cached_tried"
  - "self._output_cached_wb"
  - "self._progress"
  - "self._workbook"
  - "self.active_file_id"
  - "self.active_sheet_name"
  - "self.active_workbook"
  - "self.excel"
  - "self.inputs"
  - "self.last_output_address"
  - "self.last_output_sheet"
  - "self.output"
  - "self.output_name"
  - "self.workbook"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): self._dirty_workbook_ids, self._last_sheet_workbook_raw, self._output_cached_path, self._output_cached_tried, self._output_cached_wb, self._progress, self._workbook, self.active_file_id, self.active_sheet_name, self.active_workbook, self.excel, self.inputs, self.last_output_address, self.last_output_sheet, self.output, self.output_name, self.workbook
- 변경 상태 `self._dirty_workbook_ids, self._last_sheet_workbook_raw, self._output_cached_path, self._output_cached_tried, self._output_cached_wb, self._progress, self._workbook, self.active_file_id, self.active_sheet_name, self.active_workbook, self.excel, self.inputs, self.last_output_address, self.last_output_sheet, self.output, self.output_name, self.workbook` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_unwrap_workbook`, `_workbook_for_file_id`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
