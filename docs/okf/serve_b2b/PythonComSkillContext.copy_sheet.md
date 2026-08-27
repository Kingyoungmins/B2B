---
type: method
title: PythonComSkillContext.copy_sheet
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, src_sheet, dst_book=None, new_name=None, before=None, after=None)"
role: "시트 1장을 통째로 복사한다(서식·수식·값 보존). dst_book 을 주면 다른 파일로 복사(교차 파일)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:14509-14658"

# ── 입출력 ──
inputs:
  - "self"
  - "src_sheet"
  - "dst_book"
  - "new_name"
  - "before"
  - "after"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "파일시스템 변경/IO"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "Worksheets"
  - "_excel_collection_names"
  - "_same_excel_app"
  - "_tick"
  - "_workbook_name_lookup_key"
  - "_ws"
  - "append"
  - "book"
  - "excel_workbooks_open"
  - "session_workbook"
calls_external:
  - "Close"
  - "Copy"
  - "Path"
  - "PythonComSkillContext"
  - "PythonComSkillError"
  - "SaveAs"
  - "_copy_to_target"
  - "_name_matches"
  - "_other"
  - "_wb"
  - "actual"
  - "after"
  - "before"
  - "bool"
  - "dst_book"
  - "dst_key"
  - "dst_wb"
  - "get"
  - "int"
  - "isinstance"
  - "items"
  - "list"
  - "new_name"
  - "src_sheet"
  - "str"
  - "strip"
  - "target_app"
  - "target_session"
  - "tmp_path"
  - "unlink"
  - "uuid4"
  - "wanted"
  - "ws"
called_by: []
reads:
  - "BACKEND_DIR"
  - "EXCEL_SESSIONS"
  - "self._app"
  - "self._shared"
  - "self._tick"
  - "self._wb"
  - "self._ws"
  - "self.book"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
시트 1장을 통째로 복사한다(서식·수식·값 보존). dst_book 을 주면 다른 파일로 복사(교차 파일).

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 파일시스템 변경/IO

## 관계
- 호출: `Worksheets`, `_excel_collection_names`, `_same_excel_app`, `_tick`, `_workbook_name_lookup_key`, `_ws`, `append`, `book`, `excel_workbooks_open`, `session_workbook`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
