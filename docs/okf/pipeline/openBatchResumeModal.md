---
type: endpoint
title: openBatchResumeModal
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "버튼 클릭 진입점. 모달을 띄우기 전에 미러를 숨긴다(항상-위 Excel 이 모달을 가리는 문제 —"
role_source: banner
version: "0.7.4"
loc: "pipeline.js:4965-4965"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "_showBatchResumeChecklist"
  - "hideAllExcelMirrorWindows"
  - "pipelineEditBusyReason"
  - "pipelineHeldBatchInfo"
  - "refreshBatchResumeButton"
  - "runHeldStepsBatch"
  - "scheduleRestoreActiveExcelMirror"
  - "toast"
calls_external:
  - "String"
  - "getElementById"
  - "map"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
버튼 클릭 진입점. 모달을 띄우기 전에 미러를 숨긴다(항상-위 Excel 이 모달을 가리는 문제 —

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `_showBatchResumeChecklist`, `hideAllExcelMirrorWindows`, `pipelineEditBusyReason`, `pipelineHeldBatchInfo`, `refreshBatchResumeButton`, `runHeldStepsBatch`, `scheduleRestoreActiveExcelMirror`, `toast`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
