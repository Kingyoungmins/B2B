---
type: function
title: group_steps
module: record_service.py
lang: python
extraction: ast
signature: "(steps)"
role: "distill 결과를 역할(role) 경계로 묶는다(결정론 — LLM 그룹핑 전 단계)."
role_source: docstring
version: "0.8.0"
loc: "record_service.py:447-470"

# ── 입출력 ──
inputs:
  - "steps"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_group_title"
  - "append"
calls_external:
  - "analyze_step"
  - "cur"
  - "g"
  - "h"
  - "s"
  - "setdefault"
called_by:
  - "RecordService._run"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
distill 결과를 역할(role) 경계로 묶는다(결정론 — LLM 그룹핑 전 단계).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_group_title`, `append`
- 피호출(영향 전파 경로): `RecordService._run`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
