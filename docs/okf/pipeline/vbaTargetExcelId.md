---
type: endpoint
title: vbaTargetExcelId
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "VBA 스킬은 '사용자가 보고 있는 파일'(현재 세션)을 대상으로 실행한다 — 그 워크북에 결과를 쓴다."
role_source: banner
version: "0.7.3"
loc: "pipeline.js:363-363"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "currentExcelId"
calls_external: []
called_by:
  - "_reconcilePipelineSimulationAfterEditImpl"
  - "_runPipelineSuffixFromCheckpointImpl"
  - "applyLogic"
  - "ensureVbaRunExcelId"
  - "insertLogic"
  - "replaceLogicAt"
  - "requestExcelApplyCancel"
  - "runFromCheckpointAfterEdit"
  - "runVbaPipelinePreferLive"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
VBA 스킬은 '사용자가 보고 있는 파일'(현재 세션)을 대상으로 실행한다 — 그 워크북에 결과를 쓴다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `currentExcelId`
- 피호출(영향 전파 경로): `_reconcilePipelineSimulationAfterEditImpl`, `_runPipelineSuffixFromCheckpointImpl`, `applyLogic`, `ensureVbaRunExcelId`, `insertLogic`, `replaceLogicAt`, `requestExcelApplyCancel`, `runFromCheckpointAfterEdit`, `runVbaPipelinePreferLive`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
