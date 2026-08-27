---
type: method
title: PythonComSkillContext.match_fill
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, source, target, columns, key=None, source_header_row=1, header_row=1, rows=None, aliases=None, allow_partial=False)"
role: "소스 표(예: 피벗)의 행을 대상 시트의 '키 열(구분명)'과 이름 매칭해서, 지정한 값 열들을 대상의"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:14781-15100"

# ── 입출력 ──
inputs:
  - "self"
  - "source"
  - "target"
  - "columns"
  - "key"
  - "source_header_row"
  - "header_row"
  - "rows"
  - "aliases"
  - "allow_partial"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "_col_index"
  - "_col_letter"
  - "_ctx_and_sheet_from_spec"
  - "_num"
  - "_resolve_col"
  - "append"
  - "last_col"
  - "last_row"
  - "normalize_text"
  - "raw"
  - "read"
  - "rows"
  - "sort"
  - "write"
calls_external:
  - "PythonComSkillError"
  - "_agg_base"
  - "_combined_parts"
  - "_is_summary"
  - "_match_src"
  - "_nhard"
  - "_nlite"
  - "_parse_rows"
  - "_resolve_key_col"
  - "_resolve_val_col"
  - "_row_num"
  - "_suggest"
  - "a"
  - "abs"
  - "all"
  - "any"
  - "b"
  - "base"
  - "bool"
  - "cands"
  - "columns"
  - "dict"
  - "endswith"
  - "enumerate"
  - "float"
  - "fullmatch"
  - "get"
  - "get_close_matches"
  - "group"
  - "h"
  - "hb"
  - "hdr"
  - "hdrs"
  - "hr"
  - "i"
  - "int"
  - "isinstance"
  - "items"
  - "join"
  - "key"
called_by: []
reads:
  - "self._ctx_and_sheet_from_spec"
  - "self._shared"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
소스 표(예: 피벗)의 행을 대상 시트의 '키 열(구분명)'과 이름 매칭해서, 지정한 값 열들을 대상의

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_col_index`, `_col_letter`, `_ctx_and_sheet_from_spec`, `_num`, `_resolve_col`, `append`, `last_col`, `last_row`, `normalize_text`, `raw`, `read`, `rows`, `sort`, `write`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
