---
type: method
title: PythonComSkillContext._as_2d
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(values)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:11405-11420"

# ── 입출력 ──
inputs:
  - "values"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "append"
  - "row"
  - "rows"
  - "values"
calls_external:
  - "PythonComSkillError"
  - "isinstance"
  - "len"
  - "tuple"
called_by:
  - "PythonComSkillContext.write"
  - "PythonComSkillContext.write_formulas"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`, `row`, `rows`, `values`
- 피호출(영향 전파 경로): `PythonComSkillContext.write`, `PythonComSkillContext.write_formulas`

## 실패/예외
- `PythonComSkillError`
