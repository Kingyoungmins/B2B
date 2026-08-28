---
type: method
title: PythonComSkillContext.write_cell
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, a1, value, overwrite_formulas=True)"
role: "단일 셀 쓰기(소량 전용 — 루프에서 반복 호출하면 예산 초과로 차단됨)."
role_source: docstring
version: "0.8.1"
loc: "serve_b2b.py:12908-12910"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "a1"
  - "value"
  - "overwrite_formulas"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "sheet"
  - "write"
calls_external:
  - "a1"
  - "overwrite_formulas"
called_by: []
reads:
  - "self.write"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
단일 셀 쓰기(소량 전용 — 루프에서 반복 호출하면 예산 초과로 차단됨).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `sheet`, `write`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
