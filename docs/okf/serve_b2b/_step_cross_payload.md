---
type: function
title: _step_cross_payload
module: serve_b2b.py
lang: python
extraction: ast
signature: "(step_cross, companions)"
role: "스텝별 쓰기 증거를 클라가 쓸 형태로: 워크북 이름 → 라이브 세션 excelId."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:10435-10454"

# ── 입출력 ──
inputs:
  - "step_cross"
  - "companions"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_companion_excel_ids_for_books"
  - "append"
calls_external:
  - "any"
  - "bool"
  - "companions"
  - "get"
called_by:
  - "_run_vba_pipeline_on_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
스텝별 쓰기 증거를 클라가 쓸 형태로: 워크북 이름 → 라이브 세션 excelId.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_companion_excel_ids_for_books`, `append`
- 피호출(영향 전파 경로): `_run_vba_pipeline_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
