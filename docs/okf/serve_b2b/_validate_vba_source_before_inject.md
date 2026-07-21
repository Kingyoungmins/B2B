---
type: function
title: _validate_vba_source_before_inject
module: serve_b2b.py
lang: python
extraction: ast
signature: "(code)"
role: "VBE 디버거를 띄우는 명백한 컴파일 오류는 Excel에 주입하기 전에 차단한다."
role_source: docstring
version: "0.5.19"
loc: "serve_b2b.py:5585-5691"

# ── 입출력 ──
inputs:
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "_strip_vba_comment"
  - "append"
  - "raw"
calls_external:
  - "RuntimeError"
  - "code_text"
  - "compile"
  - "endswith"
  - "enumerate"
  - "idx"
  - "line"
  - "lines"
  - "match"
  - "pop"
  - "push"
  - "search"
  - "splitlines"
  - "str"
  - "strip"
called_by:
  - "_inject_and_run_vba"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
VBE 디버거를 띄우는 명백한 컴파일 오류는 Excel에 주입하기 전에 차단한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_strip_vba_comment`, `append`, `raw`
- 피호출(영향 전파 경로): `_inject_and_run_vba`

## 실패/예외
- `RuntimeError`
