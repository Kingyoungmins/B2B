---
type: function
title: _default_snapshot_budget_bytes
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "[SBAGENT-293 실측 2026-08-26] 스냅샷 보관 예산."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:167-185"

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
  - "disk_usage"
  - "env"
  - "get"
  - "gettempdir"
  - "int"
  - "max"
  - "min"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
[SBAGENT-293 실측 2026-08-26] 스냅샷 보관 예산.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
