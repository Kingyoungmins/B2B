---
type: method
title: PythonComSkillContext.used_range
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet)"
role: "(행수, 열수) — 시트의 사용 범위 크기."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:11178-11183"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_tick"
  - "_ws"
  - "sheet"
calls_external:
  - "int"
called_by: []
reads:
  - "self._tick"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(행수, 열수) — 시트의 사용 범위 크기.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_tick`, `_ws`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
