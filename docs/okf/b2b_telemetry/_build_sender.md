---
type: function
title: _build_sender
module: b2b_telemetry.py
lang: python
extraction: ast
signature: "()"
role: "OTLP 전송 함수를 만든다. 준비가 안 됐으면 None."
role_source: docstring
version: "0.8.1"
loc: "b2b_telemetry.py:181-228"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): _state"
raises: []

# ── 유기적 관계 ──
calls:
  - "_flatten"
  - "_missing_env"
calls_external:
  - "BatchSpanProcessor"
  - "EVENT_TYPE_RUN"
  - "OTLPSpanExporter"
  - "TracerProvider"
  - "__name__"
  - "add_span_processor"
  - "create"
  - "end"
  - "end_ns"
  - "event"
  - "exporter"
  - "get_tracer"
  - "headers"
  - "int"
  - "items"
  - "k"
  - "provider"
  - "set_attribute"
  - "set_tracer_provider"
  - "start_ns"
  - "start_span"
  - "v"
called_by:
  - "init"
reads:
  - "EVENT_TYPE_RUN"
  - "SERVICE_NAME"
  - "_state"
writes:
  - "_state"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
OTLP 전송 함수를 만든다. 준비가 안 됐으면 None.

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): _state
- 변경 상태 `_state` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_flatten`, `_missing_env`
- 피호출(영향 전파 경로): `init`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
