---
type: endpoint
title: isPythonComReadLimitRuntimeError
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(message)"
role: "Python COM 의 읽기 셀 한도(PY_READ_MAX_CELLS) 초과 런타임 오류인지 판별한다."
role_source: banner
version: "0.7.5"
loc: "chat-ui.js:2938-2938"

# ── 입출력 ──
inputs:
  - "message"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "test"
called_by:
  - "reportPipelineError"
  - "requestErrorRecovery"
  - "showRunnerPipelineError"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
Python COM 의 읽기 셀 한도(PY_READ_MAX_CELLS) 초과 런타임 오류인지 판별한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `reportPipelineError`, `requestErrorRecovery`, `showRunnerPipelineError`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
