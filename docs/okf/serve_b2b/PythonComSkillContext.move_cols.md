---
type: method
title: PythonComSkillContext.move_cols
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, columns, before, header_row=1, scan_from=None)"
role: "여러 열을 헤더+데이터까지 통째로 before 열 앞으로 옮긴다(원본 제거). 인덱스 시프트 자동."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:12382-12452"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "columns"
  - "before"
  - "header_row"
  - "scan_from"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "_col_index"
  - "_col_letter"
  - "_tick"
  - "_ws"
  - "append"
  - "copy"
  - "delete_cols"
  - "find_header"
  - "insert_cols"
  - "last_col"
  - "read"
  - "sheet"
calls_external:
  - "PythonComSkillError"
  - "_idx_of"
  - "_to_idx"
  - "before"
  - "before_idx"
  - "bool"
  - "c"
  - "callable"
  - "columns"
  - "enumerate"
  - "fullmatch"
  - "h"
  - "hdr"
  - "hr"
  - "idx1"
  - "int"
  - "isinstance"
  - "last_c"
  - "len"
  - "list"
  - "max"
  - "n"
  - "s"
  - "scan_from"
  - "set"
  - "shifted"
  - "sorted"
  - "spec"
  - "src_idx"
  - "str"
  - "strip"
called_by: []
reads:
  - "self._col_index"
  - "self._shared"
  - "self._tick"
  - "self._ws"
  - "self.copy"
  - "self.delete_cols"
  - "self.find_header"
  - "self.insert_cols"
  - "self.last_col"
  - "self.read"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
여러 열을 헤더+데이터까지 통째로 before 열 앞으로 옮긴다(원본 제거). 인덱스 시프트 자동.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_col_index`, `_col_letter`, `_tick`, `_ws`, `append`, `copy`, `delete_cols`, `find_header`, `insert_cols`, `last_col`, `read`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
