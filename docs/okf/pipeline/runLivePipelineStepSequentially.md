---
type: endpoint
title: runLivePipelineStepSequentially
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(step, excelId, options = {})"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "pipeline.js:2271-2271"

# ── 입출력 ──
inputs:
  - "step"
  - "excelId"
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "applyLiveSchemaToFileCache"
  - "attachPipelineStepError"
  - "captureStepPreApplySnapshot"
  - "hideAllExcelMirrorWindows"
  - "inferPipelineStepLanguage"
  - "isolatedPipelineStepPayload"
  - "landAppTabOnExcelSession"
  - "pipelineStepLiveLanguage"
  - "pipelineStepWritesCrossFile"
  - "postExcelMirror"
  - "scheduleRestoreActiveExcelMirror"
  - "setPipelineRuntimeStatus"
  - "showOnlyExcelMirrorWindow"
  - "wirePipelineStepCrossEvidence"
  - "wireStepCrossFromResponse"
calls_external:
  - "Error"
  - "Number"
  - "false"
  - "includes"
  - "indexOf"
  - "isArray"
  - "isInteger"
  - "now"
  - "prehide"
  - "showOnly"
called_by:
  - "applyLastEnabledStepFast"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 네트워크/서버 호출

## 관계
- 호출: `applyLiveSchemaToFileCache`, `attachPipelineStepError`, `captureStepPreApplySnapshot`, `hideAllExcelMirrorWindows`, `inferPipelineStepLanguage`, `isolatedPipelineStepPayload`, `landAppTabOnExcelSession`, `pipelineStepLiveLanguage`, `pipelineStepWritesCrossFile`, `postExcelMirror`, `scheduleRestoreActiveExcelMirror`, `setPipelineRuntimeStatus`, `showOnlyExcelMirrorWindow`, `wirePipelineStepCrossEvidence`, `wireStepCrossFromResponse`
- 피호출(영향 전파 경로): `applyLastEnabledStepFast`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
