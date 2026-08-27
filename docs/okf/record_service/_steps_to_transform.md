---
type: function
title: _steps_to_transform
module: record_service.py
lang: python
extraction: ast
signature: "(steps)"
role: "스텝 목록 → def transform(ctx) 코드(등가 게이트 대조용)."
role_source: docstring
version: "0.8.0"
loc: "record_service.py:288-293"

# ── 입출력 ──
inputs:
  - "steps"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "extend"
  - "join"
  - "lines"
  - "s"
  - "step_to_lines"
called_by:
  - "consolidate_literal_runs"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
스텝 목록 → def transform(ctx) 코드(등가 게이트 대조용).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `consolidate_literal_runs`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
