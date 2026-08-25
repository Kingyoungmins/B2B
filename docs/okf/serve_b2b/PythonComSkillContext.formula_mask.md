---
type: method
title: PythonComSkillContext.formula_mask
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, a1_range)"
role: "셀별 수식 여부를 2차원 리스트(True/False)로 반환(COM 1회)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12237-12244"

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
  - "_shaped_matrix"
  - "_tick"
  - "_ws"
  - "sheet"
calls_external:
  - "a1_range"
  - "isinstance"
  - "rng"
  - "startswith"
  - "str"
  - "v"
  - "ws"
called_by: []
reads:
  - "self._rng"
  - "self._shaped_matrix"
  - "self._tick"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
셀별 수식 여부를 2차원 리스트(True/False)로 반환(COM 1회).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_rng`, `_shaped_matrix`, `_tick`, `_ws`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
