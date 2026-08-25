---
type: method
title: PythonComSkillContext._mark_mutated
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, ws)"
role: "이 쓰기가 '어느 워크북'을 바꿨는지 기록한다. self._wb 가 아니라 시트의 부모를 본다 —"
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:11921-11934"

# ── 입출력 ──
inputs:
  - "self"
  - "ws"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "append"
  - "normalize"
calls_external:
  - "Path"
  - "casefold"
  - "full"
  - "set"
  - "setdefault"
  - "str"
called_by:
  - "PythonComSkillContext._filter_to_sheet_native"
  - "PythonComSkillContext._journal_save"
reads:
  - "self._shared"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
이 쓰기가 '어느 워크북'을 바꿨는지 기록한다. self._wb 가 아니라 시트의 부모를 본다 —

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `append`, `normalize`
- 피호출(영향 전파 경로): `PythonComSkillContext._filter_to_sheet_native`, `PythonComSkillContext._journal_save`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
