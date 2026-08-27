---
type: function
title: _fullrun_source_stamp
module: serve_b2b.py
lang: python
extraction: ast
signature: "(path)"
role: "원본 파일 지문(경로+크기+mtime). 재실행 사이에 원본이 바뀌면 이어실행을 하면 안 된다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:19750-19757"

# ── 입출력 ──
inputs:
  - "path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Path"
  - "int"
  - "lower"
  - "path"
  - "resolve"
  - "stat"
  - "str"
called_by:
  - "_run_full_pipeline_single_instance_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
원본 파일 지문(경로+크기+mtime). 재실행 사이에 원본이 바뀌면 이어실행을 하면 안 된다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_run_full_pipeline_single_instance_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
