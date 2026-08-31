---
type: function
title: _fullrun_excel_ids_for_books
module: serve_b2b.py
lang: python
extraction: ast
signature: "(by_excel, books, self_excel_id)"
role: "전체실행(한 인스턴스에 관여 파일 전부 오픈)에서 바뀐 워크북 이름 → excelId."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:10572-10588"

# ── 입출력 ──
inputs:
  - "by_excel"
  - "books"
  - "self_excel_id"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
  - "normalize"
calls_external:
  - "Path"
  - "casefold"
  - "eid"
  - "get"
  - "items"
  - "nm"
  - "set"
  - "str"
called_by:
  - "_run_full_pipeline_single_instance_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
전체실행(한 인스턴스에 관여 파일 전부 오픈)에서 바뀐 워크북 이름 → excelId.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`, `normalize`
- 피호출(영향 전파 경로): `_run_full_pipeline_single_instance_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
