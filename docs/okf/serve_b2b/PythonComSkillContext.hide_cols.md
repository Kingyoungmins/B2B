---
type: method
title: PythonComSkillContext.hide_cols
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, col_range, hidden=True)"
role: "예: ctx.hide_cols(\"매출\", \"B:D\")"
role_source: docstring
version: "0.5.18"
loc: "serve_b2b.py:9930-9936"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "col_range"
  - "hidden"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Columns"
  - "_tick"
  - "_ws"
  - "append"
  - "sheet"
calls_external:
  - "bool"
  - "col_range"
  - "hidden"
  - "str"
called_by: []
reads:
  - "self._shared"
  - "self._tick"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
예: ctx.hide_cols("매출", "B:D")

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `Columns`, `_tick`, `_ws`, `append`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
