---
type: method
title: PythonComSkillContext.copy_values
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, src_sheet, src_range, dst_sheet, dst_cell)"
role: "'값으로 복사'(계산 결과값 + 서식/숫자서식/테두리/병합 보존, 수식은 넣지 않음)."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:12648-12676"

# ── 입출력 ──
inputs:
  - "self"
  - "src_sheet"
  - "src_range"
  - "dst_sheet"
  - "dst_cell"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_ctx_and_sheet_from_spec"
  - "_journal_save"
  - "_mirror_unprotected_for_paste"
  - "_resize_rng"
  - "_rng"
  - "_tick"
  - "_ws"
  - "append"
calls_external:
  - "Copy"
  - "PasteSpecial"
  - "dst"
  - "dst_cell"
  - "dst_name"
  - "dst_sheet"
  - "dst_target"
  - "dst_ws"
  - "int"
  - "src_name"
  - "src_range"
  - "src_sheet"
  - "src_ws"
called_by: []
reads:
  - "self._app"
  - "self._ctx_and_sheet_from_spec"
  - "self._resize_rng"
  - "self._shared"
  - "self._tick"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
'값으로 복사'(계산 결과값 + 서식/숫자서식/테두리/병합 보존, 수식은 넣지 않음).

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_ctx_and_sheet_from_spec`, `_journal_save`, `_mirror_unprotected_for_paste`, `_resize_rng`, `_rng`, `_tick`, `_ws`, `append`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
