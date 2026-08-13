---
type: endpoint
title: applyMappedSingleStep
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(stepId, options = {})"
role: "[실행기 매핑 · 단일 적용] 단일 스텝 즉시 적용(토글 ON / 중간 삽입 / 수정 적용)도 반드시 '실행기"
role_source: banner
version: "0.7.3"
loc: "pipeline.js:5076-5076"

# ── 입출력 ──
inputs:
  - "stepId"
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "applyLastEnabledStepFast"
  - "beginExcelMirrorApplyLoading"
  - "beginMappedPipelineRun"
  - "endExcelMirrorApplyLoading"
  - "liveEnabledStepsSignature"
  - "noteLivePipelineApplied"
  - "restore"
calls_external:
  - "find"
called_by:
  - "_handlePipelineStepToggleImpl"
  - "insertLogic"
  - "promise"
  - "replaceLogicAt"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
[실행기 매핑 · 단일 적용] 단일 스텝 즉시 적용(토글 ON / 중간 삽입 / 수정 적용)도 반드시 '실행기

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `applyLastEnabledStepFast`, `beginExcelMirrorApplyLoading`, `beginMappedPipelineRun`, `endExcelMirrorApplyLoading`, `liveEnabledStepsSignature`, `noteLivePipelineApplied`, `restore`
- 피호출(영향 전파 경로): `_handlePipelineStepToggleImpl`, `insertLogic`, `promise`, `replaceLogicAt`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
