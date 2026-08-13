---
type: endpoint
title: captureCrossFileDestinationSnapshots
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(step, selfExcelId)"
role: "'화면은 OFF 인데 다른 파일엔 값이 있는' 유령 상태가 된다(반쪽 복원 금지)."
role_source: banner
version: "0.7.3"
loc: "pipeline.js:4305-4305"

# ── 입출력 ──
inputs:
  - "step"
  - "selfExcelId"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "crossWriteDestinationScan"
  - "excelIdForPipelineFileId"
  - "inferPipelineStepTargetFileId"
  - "postExcelMirror"
  - "push"
  - "snapExcel"
  - "stepRuntimeCrossExcelIds"
calls_external:
  - "Set"
  - "async"
  - "failed"
  - "filter"
  - "has"
  - "now"
  - "warn"
called_by:
  - "captureStepPreApplySnapshot"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
'화면은 OFF 인데 다른 파일엔 값이 있는' 유령 상태가 된다(반쪽 복원 금지).

## 사이드이펙트 & 주의
- 네트워크/서버 호출

## 관계
- 호출: `add`, `crossWriteDestinationScan`, `excelIdForPipelineFileId`, `inferPipelineStepTargetFileId`, `postExcelMirror`, `push`, `snapExcel`, `stepRuntimeCrossExcelIds`
- 피호출(영향 전파 경로): `captureStepPreApplySnapshot`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
