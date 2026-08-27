---
type: function
title: rewrite_new_sheet_refs
module: native_macro_recorder.py
lang: python
extraction: ast
signature: "(body)"
role: "Sheets.Add 로 만든 새 시트를 이후 코드가 '고정 이름'(예: \"Sheet1\")으로 참조하는"
role_source: docstring
version: "0.8.0"
loc: "native_macro_recorder.py:159-208"

# ── 입출력 ──
inputs:
  - "body"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "range"
calls_external:
  - "add_idx"
  - "enumerate"
  - "escape"
  - "group"
  - "insert"
  - "join"
  - "l"
  - "len"
  - "line"
  - "lines"
  - "list"
  - "ln"
  - "lower"
  - "match"
  - "new_name"
  - "out"
  - "search"
  - "splitlines"
  - "str"
  - "sub"
called_by:
  - "stop_native_recording_impl"
reads:
  - "_SHEET_ADD_RE"
  - "_SHEET_LIT_RE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
Sheets.Add 로 만든 새 시트를 이후 코드가 '고정 이름'(예: "Sheet1")으로 참조하는

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `range`
- 피호출(영향 전파 경로): `stop_native_recording_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
