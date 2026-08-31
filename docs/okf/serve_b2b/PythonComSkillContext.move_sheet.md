---
type: method
title: PythonComSkillContext.move_sheet
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, name, before=None, after=None)"
role: "[SBAGENT-295] 같은 파일 안에서 기존 시트의 '위치'를 바꾼다(내용·이름 유지)."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:14730-14757"

# ── 입출력 ──
inputs:
  - "self"
  - "name"
  - "before"
  - "after"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "Worksheets"
  - "_tick"
  - "_ws"
  - "append"
calls_external:
  - "Move"
  - "PythonComSkillError"
  - "after"
  - "before"
  - "int"
  - "name"
  - "str"
called_by: []
reads:
  - "self._shared"
  - "self._tick"
  - "self._wb"
  - "self._ws"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
[SBAGENT-295] 같은 파일 안에서 기존 시트의 '위치'를 바꾼다(내용·이름 유지).

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Worksheets`, `_tick`, `_ws`, `append`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
