---
type: method
title: RecordService.stop
module: record_service.py
lang: python
extraction: ast
class: RecordService
signature: "(self, timeout=120.0)"
role: "정지 신호 후 결과 대기. 반환: {\"steps\": [...], \"raw_actions\": n, ...}"
role_source: docstring
version: "0.8.0"
loc: "record_service.py:643-656"

# ── 입출력 ──
inputs:
  - "self"
  - "timeout"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls: []
calls_external:
  - "RuntimeError"
  - "join"
  - "set"
  - "timeout"
called_by:
  - "PythonComSkillContext.copy_key_blocks"
  - "_atexit_stop"
  - "_log_sync_stop"
  - "excel_record_stop"
reads:
  - "self._error"
  - "self._lock"
  - "self._recording"
  - "self._result"
  - "self._stop_evt"
  - "self._thread"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
정지 신호 후 결과 대기. 반환: {"steps": [...], "raw_actions": n, ...}

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `PythonComSkillContext.copy_key_blocks`, `_atexit_stop`, `_log_sync_stop`, `excel_record_stop`

## 실패/예외
- `RuntimeError`
