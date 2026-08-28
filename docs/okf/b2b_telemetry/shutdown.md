---
type: function
title: shutdown
module: b2b_telemetry.py
lang: python
extraction: ast
signature: "(timeout=3.0)"
role: "종료 직전 호출(멱등). 큐를 비우고 OTel 배치(기본 5초 지연)를 강제로 내보낸다."
role_source: docstring
version: "0.8.1"
loc: "b2b_telemetry.py:393-408"

# ── 입출력 ──
inputs:
  - "timeout"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_drain"
calls_external:
  - "force_flush"
  - "get"
  - "int"
  - "left_ms"
  - "max"
  - "time"
  - "timeout"
called_by:
  - "_addon_telemetry_stop"
  - "init"
  - "main"
reads:
  - "_state"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
종료 직전 호출(멱등). 큐를 비우고 OTel 배치(기본 5초 지연)를 강제로 내보낸다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_drain`
- 피호출(영향 전파 경로): `_addon_telemetry_stop`, `init`, `main`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
