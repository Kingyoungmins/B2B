---
type: endpoint
title: rollbackAddedPipelineStep
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(stepId)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.19"
loc: "pipeline.js:304-304"

# ── 입출력 ──
inputs:
  - "stepId"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: pipeline"
raises: []

# ── 유기적 관계 ──
calls:
  - "refreshRunButton"
  - "renderPipeline"
calls_external:
  - "filter"
called_by:
  - "applyLogic"
  - "applyVbaStepToLiveExcel"
  - "insertLogic"
reads:
  - "state.pipeline"
writes:
  - "pipeline"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경: pipeline
- 변경 상태 `pipeline` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `refreshRunButton`, `renderPipeline`
- 피호출(영향 전파 경로): `applyLogic`, `applyVbaStepToLiveExcel`, `insertLogic`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
