---
type: endpoint
title: wirePipelineStepSnapshots
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(stepSnapshots, excelId, sourceSteps)"
role: "[0.5.14 빠른복구] 백엔드가 격리 batch 에서 스텝 실행 '전' 상태를 SaveCopyAs 해 downloadId 로 돌려준다"
role_source: banner
version: "0.7.3"
loc: "pipeline.js:1169-1169"

# ── 입출력 ──
inputs:
  - "stepSnapshots"
  - "excelId"
  - "sourceSteps"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "syncStepPreApplySnapshot"
calls_external:
  - "find"
  - "isArray"
  - "isInteger"
  - "now"
called_by:
  - "runIsolatedLivePipelineSteps"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
[0.5.14 빠른복구] 백엔드가 격리 batch 에서 스텝 실행 '전' 상태를 SaveCopyAs 해 downloadId 로 돌려준다

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `syncStepPreApplySnapshot`
- 피호출(영향 전파 경로): `runIsolatedLivePipelineSteps`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
