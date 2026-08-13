---
type: method
title: PythonComSkillContext.sum_lookup
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, src_sheet, src_key_col, src_val_col, dst_sheet, dst_key_col, dst_out_col, header_row=None, dst_start_row=None)"
role: "키 매칭 합산(교차/동일 파일): src 의 (키→값)을 모은 뒤, dst 각 행의 키에 해당하는 값을 합산해"
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:13022-13074"

# ── 입출력 ──
inputs:
  - "self"
  - "src_sheet"
  - "src_key_col"
  - "src_val_col"
  - "dst_sheet"
  - "dst_key_col"
  - "dst_out_col"
  - "header_row"
  - "dst_start_row"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "_coerce_number"
  - "_col_letter"
  - "_ctx_and_sheet_from_spec"
  - "_resolve_col"
  - "_split_key_tokens"
  - "_tick"
  - "_vba_trace"
  - "_ws"
  - "append"
  - "header_row"
  - "last_row"
  - "range"
  - "read"
  - "used_last_row"
calls_external:
  - "dkc"
  - "dkeys"
  - "doc"
  - "dst_key_col"
  - "dst_name"
  - "dst_out_col"
  - "dst_sheet"
  - "dst_start_row"
  - "filled"
  - "get"
  - "int"
  - "keys"
  - "kmap"
  - "len"
  - "max"
  - "round"
  - "s"
  - "skc"
  - "src_key_col"
  - "src_name"
  - "src_sheet"
  - "src_val_col"
  - "str"
  - "svc"
  - "tok"
  - "vals"
called_by: []
reads:
  - "self._ctx_and_sheet_from_spec"
  - "self._shared"
  - "self._tick"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
키 매칭 합산(교차/동일 파일): src 의 (키→값)을 모은 뒤, dst 각 행의 키에 해당하는 값을 합산해

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `_coerce_number`, `_col_letter`, `_ctx_and_sheet_from_spec`, `_resolve_col`, `_split_key_tokens`, `_tick`, `_vba_trace`, `_ws`, `append`, `header_row`, `last_row`, `range`, `read`, `used_last_row`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
