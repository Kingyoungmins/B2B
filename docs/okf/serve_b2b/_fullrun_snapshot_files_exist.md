---
type: function
title: _fullrun_snapshot_files_exist
module: serve_b2b.py
lang: python
extraction: ast
signature: "(snap)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:19791-19797"

# ── 입출력 ──
inputs:
  - "snap"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "values"
calls_external:
  - "Path"
  - "all"
  - "exists"
  - "get"
  - "p"
called_by:
  - "_find_best_fullrun_snapshot"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `values`
- 피호출(영향 전파 경로): `_find_best_fullrun_snapshot`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
