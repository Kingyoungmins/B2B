---
type: method
title: PythonComSkillContext.clear_filter
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet=None)"
role: "시트에 걸린 자동필터(AutoFilter)를 해제한다 — 필터 조건을 모두 지워 숨은 행을 복원하고, 헤더의 필터"
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:12741-12775"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_tick"
  - "_ws"
  - "append"
  - "sheet"
calls_external:
  - "ShowAllData"
  - "bool"
called_by: []
reads:
  - "self._shared"
  - "self._tick"
  - "self._wb"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
시트에 걸린 자동필터(AutoFilter)를 해제한다 — 필터 조건을 모두 지워 숨은 행을 복원하고, 헤더의 필터

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_tick`, `_ws`, `append`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
