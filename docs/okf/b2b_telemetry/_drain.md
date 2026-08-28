---
type: function
title: _drain
module: b2b_telemetry.py
lang: python
extraction: ast
signature: "(timeout=3.0)"
role: "남은 것 밀어내기 — 큐에서 꺼낸 것까지 '처리 완료'를 기다린다. 오래 잡고 있지 않는다."
role_source: docstring
version: "0.8.1"
loc: "b2b_telemetry.py:380-390"

# ── 입출력 ──
inputs:
  - "timeout"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "sleep"
  - "time"
called_by:
  - "shutdown"
reads:
  - "_state"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
남은 것 밀어내기 — 큐에서 꺼낸 것까지 '처리 완료'를 기다린다. 오래 잡고 있지 않는다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `shutdown`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
