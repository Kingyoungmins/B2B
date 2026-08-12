---
type: method
title: ExcelSkillContext.write_grid
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelSkillContext
signature: "(self, ws, grid, start_row=1, start_col=1)"
role: "2D 리스트(grid)를 start_row/start_col 부터 한 번의 COM 호출로 쓴다."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:15826-15832"

# ── 입출력 ──
inputs:
  - "self"
  - "ws"
  - "grid"
  - "start_row"
  - "start_col"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): self.last_output_sheet"
raises: []

# ── 유기적 관계 ──
calls:
  - "_is_output_workbook"
  - "_write_grid"
  - "_ws_of"
calls_external:
  - "grid"
  - "start_col"
  - "start_row"
  - "ws"
called_by: []
reads:
  - "self._is_output_workbook"
  - "self._write_grid"
  - "self._ws_of"
writes:
  - "self.last_output_sheet"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
2D 리스트(grid)를 start_row/start_col 부터 한 번의 COM 호출로 쓴다.

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): self.last_output_sheet
- 변경 상태 `self.last_output_sheet` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_is_output_workbook`, `_write_grid`, `_ws_of`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
