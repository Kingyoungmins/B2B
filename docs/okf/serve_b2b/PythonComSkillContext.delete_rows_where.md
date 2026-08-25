---
type: method
title: PythonComSkillContext.delete_rows_where
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, predicate, header_rows=1)"
role: "조건에 맞는 행을 **제자리에서** 삭제한다 — 남는 행의 서식·표시형식·수식·병합이 그대로다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12736-12788"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "predicate"
  - "header_rows"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "Range"
  - "Rows"
  - "_tick"
  - "_ws"
  - "append"
  - "range"
  - "read"
  - "row"
  - "sheet"
calls_external:
  - "Delete"
  - "PythonComSkillError"
  - "Union"
  - "_CHUNK"
  - "a"
  - "b"
  - "bool"
  - "doomed"
  - "enumerate"
  - "int"
  - "len"
  - "list"
  - "max"
  - "part"
  - "predicate"
  - "r"
  - "reverse"
  - "rng"
  - "runs"
called_by: []
reads:
  - "self._app"
  - "self._shared"
  - "self._tick"
  - "self._ws"
  - "self.read"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
조건에 맞는 행을 **제자리에서** 삭제한다 — 남는 행의 서식·표시형식·수식·병합이 그대로다.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Range`, `Rows`, `_tick`, `_ws`, `append`, `range`, `read`, `row`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
