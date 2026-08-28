---
type: function
title: _drop_dead_typing_lines
module: native_macro_recorder.py
lang: python
extraction: ast
signature: "(lines)"
role: "같은 선택 셀에 연속 대입 시(사이에 같은 셀 재선택/CutCopyMode/빈 줄만 허용) 앞 대입을 버린다."
role_source: docstring
version: "0.8.1"
loc: "native_macro_recorder.py:76-105"

# ── 입출력 ──
inputs:
  - "lines"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
  - "replace"
calls_external:
  - "enumerate"
  - "group"
  - "line"
  - "lines"
  - "match"
  - "nxt"
  - "strip"
  - "upper"
called_by:
  - "sanitize_recorded_vba"
reads:
  - "_ACTIVECELL_ASSIGN"
  - "_CUTCOPY_OFF"
  - "_SELECT_LINE"
  - "_SINGLE_CELL_SELECT"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
같은 선택 셀에 연속 대입 시(사이에 같은 셀 재선택/CutCopyMode/빈 줄만 허용) 앞 대입을 버린다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`, `replace`
- 피호출(영향 전파 경로): `sanitize_recorded_vba`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
