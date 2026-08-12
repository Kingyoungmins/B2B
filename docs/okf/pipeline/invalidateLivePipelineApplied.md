---
type: endpoint
title: invalidateLivePipelineApplied
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "라이브 상태를 더 이상 신뢰할 수 없을 때(세션 전부 닫힘/초기화/적용 실패) 호출 —"
role_source: banner
version: "0.7.3"
loc: "pipeline.js:3941-3941"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
called_by:
  - "_reapplyVbaPipelineToLiveImpl"
  - "clearExcelMirrorClientState"
  - "clearRunnerLogic"
  - "forceRestartExcelMirrors"
  - "loadLogic"
  - "markLivePipelineOutOfSync"
  - "restorePipelineToCheckpointAndHold"
  - "runIsolatedLivePipelineSteps"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
라이브 상태를 더 이상 신뢰할 수 없을 때(세션 전부 닫힘/초기화/적용 실패) 호출 —

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_reapplyVbaPipelineToLiveImpl`, `clearExcelMirrorClientState`, `clearRunnerLogic`, `forceRestartExcelMirrors`, `loadLogic`, `markLivePipelineOutOfSync`, `restorePipelineToCheckpointAndHold`, `runIsolatedLivePipelineSteps`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
