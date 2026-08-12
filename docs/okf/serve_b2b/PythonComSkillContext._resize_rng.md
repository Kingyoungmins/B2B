---
type: method
title: PythonComSkillContext._resize_rng
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, ws, anchor, rows, cols)"
role: "anchor 셀에서 rows×cols 명시 범위를 만든다."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:10956-10963"

# ── 입출력 ──
inputs:
  - "self"
  - "ws"
  - "anchor"
  - "rows"
  - "cols"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Range"
  - "_col_letter"
  - "rows"
calls_external:
  - "c0"
  - "cols"
  - "int"
called_by:
  - "PythonComSkillContext.copy"
  - "PythonComSkillContext.copy_values"
  - "PythonComSkillContext.paste_copied"
  - "PythonComSkillContext.write"
  - "PythonComSkillContext.write_formulas"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
anchor 셀에서 rows×cols 명시 범위를 만든다.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Range`, `_col_letter`, `rows`
- 피호출(영향 전파 경로): `PythonComSkillContext.copy`, `PythonComSkillContext.copy_values`, `PythonComSkillContext.paste_copied`, `PythonComSkillContext.write`, `PythonComSkillContext.write_formulas`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
