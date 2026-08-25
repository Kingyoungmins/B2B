---
type: endpoint
title: captureStepPreApplySnapshot
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(step, excelId)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.5"
loc: "pipeline.js:4429-4429"

# ── 입출력 ──
inputs:
  - "step"
  - "excelId"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "captureCrossFileDestinationSnapshots"
  - "postExcelMirror"
  - "syncStepPreApplySnapshot"
calls_external:
  - "now"
  - "warn"
called_by:
  - "applyLastEnabledStepFast"
  - "applyVbaStepToLiveExcel"
  - "runLivePipelineStepSequentially"
  - "runVbaPipelinePreferLive"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 네트워크/서버 호출

## 관계
- 호출: `captureCrossFileDestinationSnapshots`, `postExcelMirror`, `syncStepPreApplySnapshot`
- 피호출(영향 전파 경로): `applyLastEnabledStepFast`, `applyVbaStepToLiveExcel`, `runLivePipelineStepSequentially`, `runVbaPipelinePreferLive`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
