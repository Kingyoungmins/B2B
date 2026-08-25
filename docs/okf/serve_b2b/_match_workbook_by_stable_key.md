---
type: function
title: _match_workbook_by_stable_key
module: serve_b2b.py
lang: python
extraction: ast
signature: "(names, requested)"
role: "열린 워크북 이름들 중 requested 와 '월/날짜 무시 안정 키'가 같은 것이 '정확히 하나'면 그 이름 반환."
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:8513-8520"

# ── 입출력 ──
inputs:
  - "names"
  - "requested"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_stable_workbook_key"
calls_external:
  - "hits"
  - "len"
  - "n"
  - "requested"
  - "want"
called_by:
  - "PythonComSkillContext._ws"
  - "PythonComSkillContext.book"
  - "_resolve_open_workbook_name"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
열린 워크북 이름들 중 requested 와 '월/날짜 무시 안정 키'가 같은 것이 '정확히 하나'면 그 이름 반환.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_stable_workbook_key`
- 피호출(영향 전파 경로): `PythonComSkillContext._ws`, `PythonComSkillContext.book`, `_resolve_open_workbook_name`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
