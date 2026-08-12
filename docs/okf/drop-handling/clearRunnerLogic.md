---
type: endpoint
title: clearRunnerLogic
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "올린 스킬을 비운다(파이프라인 + 매핑 + 대화). 파일은 건드리지 않는다 — 스킬만 교체하는 흐름."
role_source: banner
version: "0.7.3"
loc: "drop-handling.js:509-509"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: editingStepId, logicSaveBaseName, pipeline, runnerMappingChecked, runnerMappingSignature, runnerMappings"
raises: []

# ── 유기적 관계 ──
calls:
  - "clearPipelineResumeFromIndex"
  - "invalidateLivePipelineApplied"
  - "pushHistory"
  - "refreshRunButton"
  - "renderPipeline"
  - "renderRunnerWorkflow"
  - "toast"
calls_external: []
called_by:
  - "openRunnerLogicEditor"
reads:
  - "state.editingStepId"
  - "state.logicSaveBaseName"
  - "state.pipeline"
  - "state.runnerMappingChecked"
  - "state.runnerMappingSignature"
  - "state.runnerMappings"
writes:
  - "editingStepId"
  - "logicSaveBaseName"
  - "pipeline"
  - "runnerMappingChecked"
  - "runnerMappingSignature"
  - "runnerMappings"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
올린 스킬을 비운다(파이프라인 + 매핑 + 대화). 파일은 건드리지 않는다 — 스킬만 교체하는 흐름.

## 사이드이펙트 & 주의
- 상태 변경: editingStepId, logicSaveBaseName, pipeline, runnerMappingChecked, runnerMappingSignature, runnerMappings
- 변경 상태 `editingStepId, logicSaveBaseName, pipeline, runnerMappingChecked, runnerMappingSignature, runnerMappings` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `clearPipelineResumeFromIndex`, `invalidateLivePipelineApplied`, `pushHistory`, `refreshRunButton`, `renderPipeline`, `renderRunnerWorkflow`, `toast`
- 피호출(영향 전파 경로): `openRunnerLogicEditor`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
