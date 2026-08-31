---
type: endpoint
title: ensurePipelineReferencedSessionsOpen
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(steps = state.pipeline)"
role: "실행 전에 참조 파일 세션을 '전부 열고 대기'한다(읽기 소스는 reset 없이 오픈만 — 동기 오픈이라 완료 보장)."
role_source: banner
version: "0.8.2"
loc: "pipeline.js:1210-1210"

# ── 입출력 ──
inputs:
  - "steps = state.pipeline"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "collectPipelineReferencedFileIds"
  - "excelIdForPipelineFileId"
calls_external: []
called_by:
  - "applyLastEnabledStepFast"
  - "runIsolatedLivePipelineSteps"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
실행 전에 참조 파일 세션을 '전부 열고 대기'한다(읽기 소스는 reset 없이 오픈만 — 동기 오픈이라 완료 보장).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `collectPipelineReferencedFileIds`, `excelIdForPipelineFileId`
- 피호출(영향 전파 경로): `applyLastEnabledStepFast`, `runIsolatedLivePipelineSteps`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
