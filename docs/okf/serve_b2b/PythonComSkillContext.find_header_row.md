---
type: method
title: PythonComSkillContext.find_header_row
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, header_text, max_scan=30)"
role: "[SBAGENT-293 후속] 헤더 텍스트가 있는 '행 번호'(1-based)를 위에서부터 찾는다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:12589-12612"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "header_text"
  - "max_scan"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises:
  - "PythonComSkillError"

# ── 유기적 관계 ──
calls:
  - "Cells"
  - "Range"
  - "_range_matrix"
  - "_tick"
  - "_ws"
  - "normalize_text"
  - "sheet"
  - "used_last_col"
  - "values"
calls_external:
  - "PythonComSkillError"
  - "enumerate"
  - "header_text"
  - "int"
  - "max"
  - "min"
  - "scan"
  - "str"
  - "strip"
  - "target"
  - "text"
  - "v"
  - "wcols"
called_by: []
reads:
  - "self._tick"
  - "self._ws"
  - "self.used_last_col"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[SBAGENT-293 후속] 헤더 텍스트가 있는 '행 번호'(1-based)를 위에서부터 찾는다.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Cells`, `Range`, `_range_matrix`, `_tick`, `_ws`, `normalize_text`, `sheet`, `used_last_col`, `values`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `PythonComSkillError`
