---
type: method
title: PythonComSkillContext.used_last_col
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet)"
role: "시트 '사용 범위' 마지막 열(1-based). 특정 행 기준 last_col 이 그 행 병합/빈칸으로 과소산정하는 것 방지."
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:11932-11939"

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
  - "max"
called_by:
  - "PythonComSkillContext.append_same_format_sheets"
  - "PythonComSkillContext.apply_filter"
  - "PythonComSkillContext.enable_filter"
  - "PythonComSkillContext.find_header"
  - "PythonComSkillContext.first_empty_col"
  - "PythonComSkillContext.native_pivot"
  - "PythonComSkillContext.used_last_row"
reads:
  - "self._tick"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
시트 '사용 범위' 마지막 열(1-based). 특정 행 기준 last_col 이 그 행 병합/빈칸으로 과소산정하는 것 방지.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_tick`, `_ws`, `sheet`
- 피호출(영향 전파 경로): `PythonComSkillContext.append_same_format_sheets`, `PythonComSkillContext.apply_filter`, `PythonComSkillContext.enable_filter`, `PythonComSkillContext.find_header`, `PythonComSkillContext.first_empty_col`, `PythonComSkillContext.native_pivot`, `PythonComSkillContext.used_last_row`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
