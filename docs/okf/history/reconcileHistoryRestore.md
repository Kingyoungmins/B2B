---
type: endpoint
title: reconcileHistoryRestore
module: history.js
lang: js
extraction: regex   # 정규식 근사
signature: "(previousSteps)"
role: "previousSteps = 되돌리기/다시하기 '직전'의 파이프라인. 이걸 안 넘기면 사라진 스텝의 교차파일"
role_source: banner
version: "0.7.4"
loc: "history.js:161-161"

# ── 입출력 ──
inputs:
  - "previousSteps"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "reconcilePipelineSimulationAfterEdit"
  - "reportPipelineError"
calls_external:
  - "error"
called_by:
  - "redoHistory"
  - "undoHistory"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
previousSteps = 되돌리기/다시하기 '직전'의 파이프라인. 이걸 안 넘기면 사라진 스텝의 교차파일

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `reconcilePipelineSimulationAfterEdit`, `reportPipelineError`
- 피호출(영향 전파 경로): `redoHistory`, `undoHistory`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
