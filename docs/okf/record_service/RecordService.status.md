---
type: method
title: RecordService.status
module: record_service.py
lang: python
extraction: ast
class: RecordService
signature: "(self)"
role: "---- 상태 ----"
role_source: banner
version: "0.8.2"
loc: "record_service.py:646-651"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "len"
  - "strong"
called_by:
  - "B2BHandler.do_GET"
  - "B2BHandler.send_json"
  - "_process_perf_snapshot"
  - "excel_record_status"
  - "log_skill_run"
  - "start"
  - "stop"
  - "update_config"
reads:
  - "self._error"
  - "self._lock"
  - "self._recording"
  - "self._sink"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
---- 상태 ----

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `B2BHandler.do_GET`, `B2BHandler.send_json`, `_process_perf_snapshot`, `excel_record_status`, `log_skill_run`, `start`, `stop`, `update_config`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
