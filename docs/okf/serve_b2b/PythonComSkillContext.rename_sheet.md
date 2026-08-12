---
type: method
title: PythonComSkillContext.rename_sheet
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, old_name, new_name)"
role: "시트 이름만 변경한다(위치·내용 유지). '복사/이동'이 아니라 순수 이름 변경 전용."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:12759-12778"

# ── 입출력 ──
inputs:
  - "self"
  - "old_name"
  - "new_name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "_excel_collection_names"
  - "_tick"
  - "_ws"
  - "append"
calls_external:
  - "PythonComSkillError"
  - "new_name"
  - "old_name"
  - "str"
  - "sub"
called_by: []
reads:
  - "self._shared"
  - "self._tick"
  - "self._wb"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
시트 이름만 변경한다(위치·내용 유지). '복사/이동'이 아니라 순수 이름 변경 전용.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_excel_collection_names`, `_tick`, `_ws`, `append`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
