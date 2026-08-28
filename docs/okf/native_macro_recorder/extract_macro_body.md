---
type: function
title: extract_macro_body
module: native_macro_recorder.py
lang: python
extraction: ast
signature: "(module_code: str) -> str"
role: "모듈 코드에서 첫 Sub 의 본문만 (헤더/End Sub/주석 제거)."
role_source: docstring
version: "0.8.1"
loc: "native_macro_recorder.py:51-64"

# ── 입출력 ──
inputs:
  - "module_code: str"
returns: "str"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
calls_external:
  - "body"
  - "join"
  - "line"
  - "match"
  - "rstrip"
  - "splitlines"
  - "str"
  - "strip"
called_by:
  - "stop_native_recording_impl"
reads:
  - "_COMMENT_ONLY"
  - "_SUB_END"
  - "_SUB_HEADER"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
모듈 코드에서 첫 Sub 의 본문만 (헤더/End Sub/주석 제거).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`
- 피호출(영향 전파 경로): `stop_native_recording_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
