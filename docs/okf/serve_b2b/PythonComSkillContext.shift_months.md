---
type: method
title: PythonComSkillContext.shift_months
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, a1_range, delta=1)"
role: "범위 안 '문자열' 셀의 모든 'N월'(앞 'YY/YYYY년', 뒤 'D일' 포함)을 delta 개월 이동한다."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:11810-11840"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "a1_range"
  - "delta"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "_journal_save"
  - "_rng"
  - "_shift_months_in_text"
  - "_tick"
  - "_ws"
  - "range"
  - "row"
  - "sheet"
calls_external:
  - "PythonComSkillError"
  - "a1_range"
  - "data"
  - "delta"
  - "int"
  - "isinstance"
  - "ncols"
  - "nrows"
  - "rng"
  - "str"
  - "v"
  - "ws"
called_by: []
reads:
  - "self._journal_save"
  - "self._rng"
  - "self._tick"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
범위 안 '문자열' 셀의 모든 'N월'(앞 'YY/YYYY년', 뒤 'D일' 포함)을 delta 개월 이동한다.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `_journal_save`, `_rng`, `_shift_months_in_text`, `_tick`, `_ws`, `range`, `row`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
