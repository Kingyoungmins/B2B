---
type: endpoint
title: pipelinePythonMutatedBookNames
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code)"
role: "ctx.book(\"X\") 로 가져온 다른 파일을 '변형'(delete_sheet/write/clear/...)하는 경우의 X 목록."
role_source: banner
version: "0.7.5"
loc: "pipeline.js:802-802"

# ── 입출력 ──
inputs:
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "pipelineConstStringVars"
  - "pipelinePythonBookVarNames"
  - "pipelineResolvePyArg"
  - "push"
calls_external:
  - "RegExp"
  - "String"
  - "book"
  - "exec"
  - "has"
  - "includes"
  - "keys"
  - "replace"
  - "test"
called_by:
  - "crossWriteDestinationScan"
  - "inferPipelineStepTargetFileId"
  - "runVbaPipelinePreferLive"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
ctx.book("X") 로 가져온 다른 파일을 '변형'(delete_sheet/write/clear/...)하는 경우의 X 목록.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `pipelineConstStringVars`, `pipelinePythonBookVarNames`, `pipelineResolvePyArg`, `push`
- 피호출(영향 전파 경로): `crossWriteDestinationScan`, `inferPipelineStepTargetFileId`, `runVbaPipelinePreferLive`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
