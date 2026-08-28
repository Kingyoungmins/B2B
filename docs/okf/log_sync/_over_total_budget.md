---
type: function
title: _over_total_budget
module: log_sync.py
lang: python
extraction: ast
signature: "()"
role: "[코드리뷰 2026-08-24] MAX_TOTAL_BYTES 가 로그에만 걸려 있었다. auto_backup 은 편집할 때마다"
role_source: docstring
version: "0.8.1"
loc: "log_sync.py:372-375"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "get"
  - "int"
called_by:
  - "tick"
reads:
  - "MAX_TOTAL_BYTES"
  - "_STATE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
[코드리뷰 2026-08-24] MAX_TOTAL_BYTES 가 로그에만 걸려 있었다. auto_backup 은 편집할 때마다

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `tick`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
