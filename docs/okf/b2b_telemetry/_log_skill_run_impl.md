---
type: function
title: _log_skill_run_impl
module: b2b_telemetry.py
lang: python
extraction: ast
signature: "(skill_name, step_count, status, started_at, ended_at, file_count, languages, output_mode, error_code, error_message, extra)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "b2b_telemetry.py:267-337"

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
  - "_mask"
  - "_utc"
  - "_whoami"
  - "init"
calls_external:
  - "error_message"
  - "event"
  - "extra"
  - "get"
  - "gethostname"
  - "int"
  - "max"
  - "put_nowait"
  - "skill_name"
  - "t0"
  - "t1"
  - "time"
  - "update"
  - "uuid4"
called_by:
  - "log_skill_run"
reads:
  - "ACTOR_TYPE"
  - "AGENT_ID"
  - "AGENT_TYPE"
  - "CLOUD"
  - "COST_USD"
  - "ENVIRONMENT"
  - "EVENT_TYPE_RUN"
  - "MODEL"
  - "PROVIDER"
  - "SERVICE_NAME"
  - "SPAN_KIND_WORKFLOW"
  - "TENANT_ID"
  - "_state"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_mask`, `_utc`, `_whoami`, `init`
- 피호출(영향 전파 경로): `log_skill_run`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
