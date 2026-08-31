---
type: function
title: log_skill_run
module: b2b_telemetry.py
lang: python
extraction: ast
signature: "(skill_name='', step_count=0, status='success', started_at=None, ended_at=None, file_count=0, languages='', output_mode='', error_code=None, error_message=None, extra=None)"
role: "스킬 전체실행 1건을 기록한다."
role_source: docstring
version: "0.8.2"
loc: "b2b_telemetry.py:251-264"

# ── 입출력 ──
inputs:
  - "skill_name"
  - "step_count"
  - "status"
  - "started_at"
  - "ended_at"
  - "file_count"
  - "languages"
  - "output_mode"
  - "error_code"
  - "error_message"
  - "extra"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_log_skill_run_impl"
  - "status"
calls_external:
  - "ended_at"
  - "error_code"
  - "error_message"
  - "extra"
  - "file_count"
  - "languages"
  - "output_mode"
  - "skill_name"
  - "started_at"
  - "step_count"
called_by:
  - "_addon_log_skill_run"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
스킬 전체실행 1건을 기록한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_log_skill_run_impl`, `status`
- 피호출(영향 전파 경로): `_addon_log_skill_run`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
