---
type: endpoint
title: pipelineSuffixCrossUnresolvedNames
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(steps, startIdx)"
role: "되돌리기 안전 판정용: 이 구간에서 '어느 파일인지 모르겠다'고 나온 이름들."
role_source: banner
version: "0.7.3"
loc: "pipeline.js:1064-1064"

# ── 입출력 ──
inputs:
  - "steps"
  - "startIdx"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "crossWriteDestinationScan"
  - "inferPipelineStepTargetFileId"
calls_external:
  - "Set"
  - "forEach"
  - "from"
  - "join"
  - "max"
  - "slice"
called_by:
  - "_handlePipelineStepToggleImpl"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
되돌리기 안전 판정용: 이 구간에서 '어느 파일인지 모르겠다'고 나온 이름들.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `crossWriteDestinationScan`, `inferPipelineStepTargetFileId`
- 피호출(영향 전파 경로): `_handlePipelineStepToggleImpl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
