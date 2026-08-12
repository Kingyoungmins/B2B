---
type: function
title: _workbook_link_source_names
module: serve_b2b.py
lang: python
extraction: ast
signature: "(wb)"
role: "워크북이 수식으로 참조하는 외부 엑셀 링크의 파일명 집합(소문자)."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:9651-9674"

# ── 입출력 ──
inputs:
  - "wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "normalize"
calls_external:
  - "LinkSources"
  - "Path"
  - "casefold"
  - "isinstance"
  - "item"
  - "links"
  - "list"
  - "nm"
  - "set"
  - "str"
called_by:
  - "_setup_isolated_pipeline_instance"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
워크북이 수식으로 참조하는 외부 엑셀 링크의 파일명 집합(소문자).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `normalize`
- 피호출(영향 전파 경로): `_setup_isolated_pipeline_instance`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
