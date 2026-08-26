---
type: method
title: PythonComSkillContext.enable_filter
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet=None, header_row=1)"
role: "시트 헤더행에 자동필터(필터 드롭다운)를 켠다 — 조건 없이 '필터 기능만' 활성화한다(이미 켜져 있으면 유지)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12844-12861"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "header_row"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "Range"
  - "_tick"
  - "_ws"
  - "append"
  - "sheet"
  - "used_last_col"
  - "used_last_row"
calls_external:
  - "AutoFilter"
  - "bool"
  - "hr"
  - "int"
  - "last_c"
  - "last_r"
  - "max"
called_by: []
reads:
  - "self._shared"
  - "self._tick"
  - "self._wb"
  - "self._ws"
  - "self.used_last_col"
  - "self.used_last_row"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
시트 헤더행에 자동필터(필터 드롭다운)를 켠다 — 조건 없이 '필터 기능만' 활성화한다(이미 켜져 있으면 유지).

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `Range`, `_tick`, `_ws`, `append`, `sheet`, `used_last_col`, `used_last_row`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
