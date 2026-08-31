---
type: function
title: status
module: b2b_telemetry.py
lang: python
extraction: ast
signature: "()"
role: "지금 어떤 상태인지 (진단용)."
role_source: docstring
version: "0.8.2"
loc: "b2b_telemetry.py:168-170"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_status_dict"
calls_external: []
called_by:
  - "B2BHandler.do_GET"
  - "B2BHandler.send_json"
  - "_process_perf_snapshot"
  - "excel_record_status"
  - "log_skill_run"
  - "start"
  - "stop"
  - "update_config"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
지금 어떤 상태인지 (진단용).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_status_dict`
- 피호출(영향 전파 경로): `B2BHandler.do_GET`, `B2BHandler.send_json`, `_process_perf_snapshot`, `excel_record_status`, `log_skill_run`, `start`, `stop`, `update_config`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
