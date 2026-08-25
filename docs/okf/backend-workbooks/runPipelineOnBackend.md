---
type: endpoint
title: runPipelineOnBackend
module: backend-workbooks.js
lang: js
extraction: regex   # 정규식 근사
signature: "(options = {})"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "backend-workbooks.js:581-581"

# ── 입출력 ──
inputs:
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "네트워크/서버 호출"
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls:
  - "adaptPipelineForRun"
  - "applyBackendPipelineResult"
  - "attachBackendRunClientContext"
  - "beginExcelMirrorApplyLoading"
  - "canRunPipelineOnBackend"
  - "captureBackendCurrentViewForApply"
  - "endExcelMirrorApplyLoading"
  - "excelMirrorSessionIdForFileId"
  - "formatBackendProgress"
  - "getBackendOutputTarget"
  - "getFile"
  - "getSkillEngine"
  - "inferPipelineStepLanguage"
  - "inferPipelineStepTargetFileId"
  - "muteExcelMirrorForPipeline"
  - "pipelineFullRunStateSig"
  - "pipelineUsesPython"
  - "releaseExcelMirrorPipelineMute"
  - "restoreActiveExcelMirrorWindow"
  - "setProgress"
  - "toast"
calls_external:
  - "Error"
  - "Excel"
  - "JS"
  - "Number"
  - "Promise"
  - "Python"
  - "encodeURIComponent"
  - "fetch"
  - "filter"
  - "generatorSetProgress"
  - "includes"
  - "json"
  - "map"
  - "now"
  - "parse"
  - "recordBackendDebugTiming"
  - "runnerSetProgress"
  - "setTimeout"
  - "some"
  - "stringify"
  - "text"
called_by:
  - "runPipelinePreferBackend"
reads:
  - "state.currentFileId"
  - "state.currentSheet"
  - "state.inputsOriginal"
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 네트워크/서버 호출
- 타이머

## 관계
- 호출: `adaptPipelineForRun`, `applyBackendPipelineResult`, `attachBackendRunClientContext`, `beginExcelMirrorApplyLoading`, `canRunPipelineOnBackend`, `captureBackendCurrentViewForApply`, `endExcelMirrorApplyLoading`, `excelMirrorSessionIdForFileId`, `formatBackendProgress`, `getBackendOutputTarget`, `getFile`, `getSkillEngine`, `inferPipelineStepLanguage`, `inferPipelineStepTargetFileId`, `muteExcelMirrorForPipeline`, `pipelineFullRunStateSig`, `pipelineUsesPython`, `releaseExcelMirrorPipelineMute`, `restoreActiveExcelMirrorWindow`, `setProgress`, `toast`
- 피호출(영향 전파 경로): `runPipelinePreferBackend`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
