---
type: method
title: PythonComSkillContext.copy_col
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, sheet, src, dst, header_row=None)"
role: "열 → 열 '복사'(원본 유지). 값+수식+서식+세로병합 보존, 상단 제목의 가로 병합은 자동 회피,"
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:12454-12458"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet"
  - "src"
  - "dst"
  - "header_row"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "header_row"
  - "move_col_clear"
  - "sheet"
calls_external:
  - "dst"
  - "src"
called_by: []
reads:
  - "self.move_col_clear"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
열 → 열 '복사'(원본 유지). 값+수식+서식+세로병합 보존, 상단 제목의 가로 병합은 자동 회피,

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `header_row`, `move_col_clear`, `sheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
