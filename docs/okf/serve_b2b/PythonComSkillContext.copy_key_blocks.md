---
type: method
title: PythonComSkillContext.copy_key_blocks
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, src_sheet, dst_sheet, key_col, first_col, last_col, src_scan=None, dst_scan=None, on_mismatch='skip')"
role: "'가입번호'처럼 키가 여러 행 세로병합 블록을 이루는 표에서, 대상의 각 키 블록에 소스의"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:14340-14425"

# ── 입출력 ──
inputs:
  - "self"
  - "src_sheet"
  - "dst_sheet"
  - "key_col"
  - "first_col"
  - "last_col"
  - "src_scan"
  - "dst_scan"
  - "on_mismatch"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "Range"
  - "_col_letter"
  - "_ctx_and_sheet_from_spec"
  - "_norm_key"
  - "_resolve_col"
  - "_tick"
  - "_vba_trace"
  - "_ws"
  - "append"
  - "last_col"
calls_external:
  - "Copy"
  - "End"
  - "UnMerge"
  - "_XL_UP"
  - "blocks"
  - "copied"
  - "dh"
  - "dst_name"
  - "dst_scan"
  - "dst_sheet"
  - "dtop"
  - "fc_d"
  - "fc_s"
  - "first_col"
  - "get"
  - "int"
  - "kc"
  - "kc_d"
  - "kc_s"
  - "key_col"
  - "lc_d"
  - "lc_s"
  - "len"
  - "max"
  - "min"
  - "mism"
  - "missing"
  - "nk"
  - "r"
  - "scan"
  - "sh"
  - "src_name"
  - "src_scan"
  - "src_sheet"
  - "stop"
  - "str"
  - "top"
  - "ws_d"
  - "ws_s"
called_by: []
reads:
  - "_XL_UP"
  - "self._app"
  - "self._ctx_and_sheet_from_spec"
  - "self._shared"
  - "self._tick"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
'가입번호'처럼 키가 여러 행 세로병합 블록을 이루는 표에서, 대상의 각 키 블록에 소스의

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `Range`, `_col_letter`, `_ctx_and_sheet_from_spec`, `_norm_key`, `_resolve_col`, `_tick`, `_vba_trace`, `_ws`, `append`, `last_col`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
