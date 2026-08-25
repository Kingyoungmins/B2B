---
type: endpoint
title: markLivePipelineOutOfSync
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(reason)"
role: "복구가 워크북을 '파일에서 다시 열었다'(reopened) = 메모리에 적용돼 있던 스킬 결과가"
role_source: banner
version: "0.8.0"
loc: "excel-mirror.js:1170-1170"

# ── 입출력 ──
inputs:
  - "reason"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "invalidateLivePipelineApplied"
  - "refreshRunButton"
  - "renderPipeline"
  - "setPipelineResumeFromIndex"
  - "setPipelineRuntimeStatus"
  - "toast"
  - "traceClientUiEvent"
calls_external:
  - "String"
  - "filter"
  - "forEach"
  - "map"
called_by:
  - "maybeAutoReapplyAfterRecover"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
복구가 워크북을 '파일에서 다시 열었다'(reopened) = 메모리에 적용돼 있던 스킬 결과가

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `invalidateLivePipelineApplied`, `refreshRunButton`, `renderPipeline`, `setPipelineResumeFromIndex`, `setPipelineRuntimeStatus`, `toast`, `traceClientUiEvent`
- 피호출(영향 전파 경로): `maybeAutoReapplyAfterRecover`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
