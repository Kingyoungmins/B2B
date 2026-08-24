---
type: endpoint
title: landAppTabOnExcelSession
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(excelId)"
role: "창을 도로 어긋나게 만들었다. 동기로 즉시 맞춘다."
role_source: banner
version: "0.7.4"
loc: "pipeline.js:4602-4602"

# ── 입출력 ──
inputs:
  - "excelId"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "fileIdForExcelMirrorId"
  - "setCurrentView"
calls_external:
  - "warn"
called_by:
  - "_restoreSnapshotByIds"
  - "applyVbaStepToLiveExcel"
  - "runLivePipelineStepSequentially"
reads:
  - "state.currentFileId"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
창을 도로 어긋나게 만들었다. 동기로 즉시 맞춘다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `fileIdForExcelMirrorId`, `setCurrentView`
- 피호출(영향 전파 경로): `_restoreSnapshotByIds`, `applyVbaStepToLiveExcel`, `runLivePipelineStepSequentially`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
