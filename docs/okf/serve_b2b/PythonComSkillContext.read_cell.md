---
type: method
title: PythonComSkillContext.read_cell
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, a1)"
role: "단일 셀 읽기(write_cell 와 대칭). 스칼라 값 반환(빈 셀은 None)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12241-12245"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "a1"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "read"
  - "sheet"
calls_external:
  - "a1"
called_by: []
reads:
  - "self.read"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
단일 셀 읽기(write_cell 와 대칭). 스칼라 값 반환(빈 셀은 None).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `read`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
