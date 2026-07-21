---
type: function
title: _trace_text
module: serve_b2b.py
lang: python
extraction: ast
signature: "(value, limit=500)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.19"
loc: "serve_b2b.py:6437-6442"

# ── 입출력 ──
inputs:
  - "value"
  - "limit"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "replace"
calls_external:
  - "len"
  - "str"
  - "text"
called_by:
  - "B2BHandler.handle_excel_run_vba"
  - "B2BHandler.handle_excel_run_vba_pipeline"
  - "_inject_and_run_vba"
  - "_inject_and_run_vba_in_host"
  - "_run_vba_macro_any_ref"
  - "_run_vba_pipeline_on_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `replace`
- 피호출(영향 전파 경로): `B2BHandler.handle_excel_run_vba`, `B2BHandler.handle_excel_run_vba_pipeline`, `_inject_and_run_vba`, `_inject_and_run_vba_in_host`, `_run_vba_macro_any_ref`, `_run_vba_pipeline_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
