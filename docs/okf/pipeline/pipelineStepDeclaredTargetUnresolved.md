---
type: endpoint
title: pipelineStepDeclaredTargetUnresolved
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(step)"
role: "실행기에서만 터지는 이유: 생성기는 대상이 늘 실재하는 현재 파일이라 폴백이 안 일어난다."
role_source: banner
version: "0.7.3"
loc: "pipeline.js:559-559"

# ── 입출력 ──
inputs:
  - "step"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "inferPipelineStepTargetFileId"
  - "pipelineResolveSavedTargetFileId"
calls_external:
  - "String"
  - "book"
  - "slice"
  - "startsWith"
called_by:
  - "pipelineStepsWithUnresolvedTarget"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
실행기에서만 터지는 이유: 생성기는 대상이 늘 실재하는 현재 파일이라 폴백이 안 일어난다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `inferPipelineStepTargetFileId`, `pipelineResolveSavedTargetFileId`
- 피호출(영향 전파 경로): `pipelineStepsWithUnresolvedTarget`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
