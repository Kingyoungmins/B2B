---
type: method
title: PythonComSkillContext.paste_copied
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, src_sheet, src_range, dst_sheet, dst_cell, src_book=None, dst_book=None, values_only=False)"
role: "[복붙 캡처 재생] 사용자가 라이브 Excel에서 Ctrl+C/Ctrl+V 한 동작을 그대로 재현한다."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:11543-11648"

# ── 입출력 ──
inputs:
  - "self"
  - "src_sheet"
  - "src_range"
  - "dst_sheet"
  - "dst_cell"
  - "src_book"
  - "dst_book"
  - "values_only"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "Range"
  - "_journal_save"
  - "_mirror_unprotected_for_paste"
  - "_registered_path_for_name"
  - "_resize_rng"
  - "_rng"
  - "_tick"
  - "_vba_trace"
  - "_ws"
  - "append"
  - "book"
  - "excel_workbooks_open"
calls_external:
  - "Calculate"
  - "Close"
  - "Copy"
  - "Intersect"
  - "PasteSpecial"
  - "Path"
  - "PythonComSkillContext"
  - "backup"
  - "band"
  - "c0"
  - "dst"
  - "dst_book"
  - "dst_cell"
  - "dst_sheet"
  - "dst_target"
  - "dst_ws"
  - "exists"
  - "int"
  - "opened_src"
  - "opened_src_temp"
  - "p"
  - "r0"
  - "src_book"
  - "src_cols"
  - "src_range"
  - "src_rows"
  - "src_sheet"
  - "src_ws"
  - "unlink"
called_by: []
reads:
  - "self._app"
  - "self._session"
  - "self._shared"
  - "self._tick"
  - "self.book"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
[복붙 캡처 재생] 사용자가 라이브 Excel에서 Ctrl+C/Ctrl+V 한 동작을 그대로 재현한다.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 파일시스템 변경/IO

## 관계
- 호출: `Cells`, `Range`, `_journal_save`, `_mirror_unprotected_for_paste`, `_registered_path_for_name`, `_resize_rng`, `_rng`, `_tick`, `_vba_trace`, `_ws`, `append`, `book`, `excel_workbooks_open`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
