---
type: function
title: _isolated_wb_path
module: serve_b2b.py
lang: python
extraction: ast
signature: "(wb)"
role: "열려 있는 워크북의 실제 파일 경로(라벨 판별용). 못 구하면 빈 문자열."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:3550-3555"

# ── 입출력 ──
inputs:
  - "wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
called_by:
  - "_run_full_pipeline_single_instance_impl"
  - "_run_vba_pipeline_on_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
열려 있는 워크북의 실제 파일 경로(라벨 판별용). 못 구하면 빈 문자열.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_run_full_pipeline_single_instance_impl`, `_run_vba_pipeline_on_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
