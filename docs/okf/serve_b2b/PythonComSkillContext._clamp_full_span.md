---
type: method
title: PythonComSkillContext._clamp_full_span
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, ws, rng)"
role: "열 전체(D:D)/행 전체(3:3) 참조를 그 시트의 실제 사용 범위까지로 줄인다."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:13101-13124"

# ── 입출력 ──
inputs:
  - "self"
  - "ws"
  - "rng"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_resize_rng"
  - "rows"
calls_external:
  - "cols"
  - "int"
  - "max"
  - "rng"
  - "ws"
called_by:
  - "PythonComSkillContext.copy"
reads:
  - "self._resize_rng"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
열 전체(D:D)/행 전체(3:3) 참조를 그 시트의 실제 사용 범위까지로 줄인다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_resize_rng`, `rows`
- 피호출(영향 전파 경로): `PythonComSkillContext.copy`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
