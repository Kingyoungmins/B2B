---
type: function
title: _utc
module: b2b_telemetry.py
lang: python
extraction: ast
signature: "(ts=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "b2b_telemetry.py:94-96"

# ── 입출력 ──
inputs:
  - "ts"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "fromtimestamp"
  - "now"
  - "strftime"
  - "ts"
called_by:
  - "_log_skill_run_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_log_skill_run_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
