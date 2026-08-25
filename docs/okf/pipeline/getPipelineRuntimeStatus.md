---
type: endpoint
title: getPipelineRuntimeStatus
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(stepId)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "pipeline.js:207-207"

# ── 입출력 ──
inputs:
  - "stepId"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
called_by:
  - "_buildLogicZipEntriesImpl"
  - "_runHeldStepsBatchImpl"
  - "_syncPipelineToggleStatus"
  - "canFastEditLastPipelineStep"
  - "markPipelineRunFailureStatus"
  - "noteLivePipelineApplied"
  - "pipelineStepIsStaticTrusted"
  - "renderPipeline"
  - "replaceLogicAt"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_buildLogicZipEntriesImpl`, `_runHeldStepsBatchImpl`, `_syncPipelineToggleStatus`, `canFastEditLastPipelineStep`, `markPipelineRunFailureStatus`, `noteLivePipelineApplied`, `pipelineStepIsStaticTrusted`, `renderPipeline`, `replaceLogicAt`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
