---
type: method
title: PythonComSkillContext.has_formulas
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, a1_range)"
role: "범위에 수식이 하나라도 있으면 True."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:12849-12855"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "a1_range"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_rng"
  - "_tick"
  - "_ws"
  - "sheet"
calls_external:
  - "a1_range"
  - "ws"
called_by: []
reads:
  - "self._rng"
  - "self._tick"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
범위에 수식이 하나라도 있으면 True.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_rng`, `_tick`, `_ws`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
