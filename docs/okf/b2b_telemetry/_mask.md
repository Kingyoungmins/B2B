---
type: function
title: _mask
module: b2b_telemetry.py
lang: python
extraction: ast
signature: "(text)"
role: "업무 텍스트(스킬명·오류 메시지) 가리기. 기준이 정해지기 전 기본은 원문."
role_source: docstring
version: "0.8.2"
loc: "b2b_telemetry.py:115-120"

# ── 입출력 ──
inputs:
  - "text"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "encode"
  - "hexdigest"
  - "sha256"
  - "str"
  - "text"
called_by:
  - "_log_skill_run_impl"
reads:
  - "MASK_BUSINESS_TEXT"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
업무 텍스트(스킬명·오류 메시지) 가리기. 기준이 정해지기 전 기본은 원문.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_log_skill_run_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
