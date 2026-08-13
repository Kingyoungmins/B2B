---
type: method
title: PythonComSkillContext.read_formulas
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, a1_range)"
role: "범위의 수식 문자열을 2차원 리스트로 읽는다(수식 없는 셀은 값)."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:11644-11657"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "a1_range"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "_note_read_evidence"
  - "_rng"
  - "_shaped_matrix"
  - "_tick"
  - "_ws"
  - "sheet"
calls_external:
  - "PythonComSkillError"
  - "a1_range"
  - "int"
  - "out"
  - "rng"
  - "ws"
called_by: []
reads:
  - "PY_READ_MAX_CELLS"
  - "self._note_read_evidence"
  - "self._rng"
  - "self._shaped_matrix"
  - "self._tick"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
범위의 수식 문자열을 2차원 리스트로 읽는다(수식 없는 셀은 값).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_note_read_evidence`, `_rng`, `_shaped_matrix`, `_tick`, `_ws`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
