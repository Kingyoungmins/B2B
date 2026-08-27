---
type: function
title: _format_unionable
module: record_service.py
lang: python
extraction: ast
signature: "(fmt)"
role: "이 서식이 여러 영역을 union 주소 한 번에 적용해도 안전한가."
role_source: docstring
version: "0.8.0"
loc: "record_service.py:370-375"

# ── 입출력 ──
inputs:
  - "fmt"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "get"
called_by:
  - "consolidate_format_runs"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
이 서식이 여러 영역을 union 주소 한 번에 적용해도 안전한가.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `consolidate_format_runs`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
