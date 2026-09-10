---
type: function
title: _is_summary_or_blank_row
module: serve_b2b.py
lang: python
extraction: ast
signature: "(row)"
role: "[정렬 요약행 고정 2026-09-08] 행의 앞 3칸에 합계/평균 류 라벨이 있거나, 행이 통째로 비었으면 True."
role_source: docstring
version: "0.8.4"
loc: "serve_b2b.py:16804-16822"

# ── 입출력 ──
inputs:
  - "row"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "all"
  - "c"
  - "endswith"
  - "isinstance"
  - "len"
  - "lower"
  - "n"
  - "search"
  - "str"
  - "strip"
  - "sub"
called_by:
  - "PythonComSkillContext.sort"
reads:
  - "_SUMMARY_LABEL_RE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.4-gen"
---

## 역할
[정렬 요약행 고정 2026-09-08] 행의 앞 3칸에 합계/평균 류 라벨이 있거나, 행이 통째로 비었으면 True.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `PythonComSkillContext.sort`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
