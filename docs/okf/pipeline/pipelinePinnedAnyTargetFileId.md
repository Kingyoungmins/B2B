---
type: endpoint
title: pipelinePinnedAnyTargetFileId
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(steps = state.pipeline)"
role: "python 스텝까지 포함한 언어 무관 핀 대상(백엔드 재실행 후 '변경된 파일' 탭 이동용)."
role_source: banner
version: "0.8.1"
loc: "pipeline.js:882-882"

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
  - "getFile"
  - "inferPipelineStepTargetFileId"
  - "pipelineStepLiveLanguage"
calls_external:
  - "filter"
  - "resolve"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
python 스텝까지 포함한 언어 무관 핀 대상(백엔드 재실행 후 '변경된 파일' 탭 이동용).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `getFile`, `inferPipelineStepTargetFileId`, `pipelineStepLiveLanguage`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
