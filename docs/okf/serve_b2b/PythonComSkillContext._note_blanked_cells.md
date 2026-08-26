---
type: method
title: PythonComSkillContext._note_blanked_cells
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, before, data)"
role: "앞 단계가 채워 둔 칸을 이번 쓰기가 '빈칸으로' 덮었는지 센다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12063-12089"

# ── 입출력 ──
inputs:
  - "self"
  - "before"
  - "data"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "data"
  - "enumerate"
  - "get"
  - "int"
  - "len"
  - "new_row"
  - "nv"
  - "old"
  - "str"
  - "strip"
called_by:
  - "PythonComSkillContext._note_blanked_cells_from_range"
reads:
  - "self._shared"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
앞 단계가 채워 둔 칸을 이번 쓰기가 '빈칸으로' 덮었는지 센다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `PythonComSkillContext._note_blanked_cells_from_range`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
