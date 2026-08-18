---
type: endpoint
title: requestExcelApplyCancel
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "[#19] 진행 중인 단일 VBA 적용을 취소하고 안전 복귀한다."
role_source: banner
version: "0.7.4"
loc: "pipeline.js:1980-1980"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "상태 변경: pipeline"
raises: []

# ── 유기적 관계 ──
calls:
  - "escalateExcelStopToForceRestart"
  - "reapplyVbaPipelineToLive"
  - "refreshRunButton"
  - "renderPipeline"
  - "setPipelineRuntimeStatus"
  - "toast"
  - "vbaTargetExcelId"
  - "waitRestoreOrStall"
calls_external:
  - "filter"
  - "findIndex"
  - "isArray"
  - "then"
called_by:
  - "_ensureExcelCancelButton"
  - "applyLogic"
  - "applyVbaStepToLiveExcel"
  - "beginExcelMirrorApplyLoading"
  - "insertLogic"
  - "replaceLogicAt"
reads:
  - "state.pipeline"
writes:
  - "pipeline"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[#19] 진행 중인 단일 VBA 적용을 취소하고 안전 복귀한다.

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 상태 변경: pipeline
- 변경 상태 `pipeline` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `escalateExcelStopToForceRestart`, `reapplyVbaPipelineToLive`, `refreshRunButton`, `renderPipeline`, `setPipelineRuntimeStatus`, `toast`, `vbaTargetExcelId`, `waitRestoreOrStall`
- 피호출(영향 전파 경로): `_ensureExcelCancelButton`, `applyLogic`, `applyVbaStepToLiveExcel`, `beginExcelMirrorApplyLoading`, `insertLogic`, `replaceLogicAt`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
