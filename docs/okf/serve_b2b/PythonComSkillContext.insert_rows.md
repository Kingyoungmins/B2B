---
type: method
title: PythonComSkillContext.insert_rows
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, row, count=1)"
role: "---- 구조 변경(저널 롤백 불가 → structural 표시) ----"
role_source: banner
version: "0.7.4"
loc: "serve_b2b.py:12259-12271"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "row"
  - "count"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Rows"
  - "_tick"
  - "_ws"
  - "append"
  - "row"
  - "sheet"
calls_external:
  - "Insert"
  - "count"
  - "int"
  - "isinstance"
  - "spec"
  - "str"
  - "strip"
called_by: []
reads:
  - "self._shared"
  - "self._tick"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
---- 구조 변경(저널 롤백 불가 → structural 표시) ----

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `Rows`, `_tick`, `_ws`, `append`, `row`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
