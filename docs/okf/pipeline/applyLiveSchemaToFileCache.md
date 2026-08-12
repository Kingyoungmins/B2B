---
type: endpoint
title: applyLiveSchemaToFileCache
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(excelId, schema)"
role: "[#5] 라이브 COM 적용으로 구조가 바뀐 파일의 클라 스키마 캐시(미리보기 AoA/시트명/차원)를"
role_source: banner
version: "0.7.3"
loc: "pipeline.js:4762-4762"

# ── 입출력 ──
inputs:
  - "excelId"
  - "schema"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "fileIdForExcelMirrorId"
  - "getFile"
  - "syncFileMetadata"
calls_external:
  - "forEach"
  - "includes"
  - "isArray"
  - "keys"
called_by:
  - "_assistRefreshLiveFile"
  - "applyVbaStepToLiveExcel"
  - "restoreLastStepPreApplySnapshot"
  - "runIsolatedLivePipelineSteps"
  - "runLivePipelineStepSequentially"
reads:
  - "state.inputsOriginal"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
[#5] 라이브 COM 적용으로 구조가 바뀐 파일의 클라 스키마 캐시(미리보기 AoA/시트명/차원)를

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `fileIdForExcelMirrorId`, `getFile`, `syncFileMetadata`
- 피호출(영향 전파 경로): `_assistRefreshLiveFile`, `applyVbaStepToLiveExcel`, `restoreLastStepPreApplySnapshot`, `runIsolatedLivePipelineSteps`, `runLivePipelineStepSequentially`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
