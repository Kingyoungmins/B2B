---
type: endpoint
title: crossWriteDestinationScan
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code, options = {})"
role: "코드가 '다른 파일에 쓴다'고 지목한 워크북들을 훑는다."
role_source: banner
version: "0.7.4"
loc: "pipeline.js:995-995"

# ── 입출력 ──
inputs:
  - "code"
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "pipelineConstStringVars"
  - "pipelineFileIdByWorkbookName"
  - "pipelinePythonMutatedBookNames"
  - "pipelineResolvePyArg"
  - "pipelineStripCodeComments"
  - "pipelineVbaTargetWorkbookNames"
  - "push"
calls_external:
  - "Set"
  - "String"
  - "Windows"
  - "Workbooks"
  - "addName"
  - "addToken"
  - "book"
  - "exec"
  - "forEach"
  - "has"
  - "python"
  - "test"
  - "trim"
  - "write"
called_by:
  - "captureCrossFileDestinationSnapshots"
  - "crossWriteDestinationFileIds"
  - "pipelineStepWritesCrossFile"
  - "pipelineSuffixCrossUnresolvedNames"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
코드가 '다른 파일에 쓴다'고 지목한 워크북들을 훑는다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `pipelineConstStringVars`, `pipelineFileIdByWorkbookName`, `pipelinePythonMutatedBookNames`, `pipelineResolvePyArg`, `pipelineStripCodeComments`, `pipelineVbaTargetWorkbookNames`, `push`
- 피호출(영향 전파 경로): `captureCrossFileDestinationSnapshots`, `crossWriteDestinationFileIds`, `pipelineStepWritesCrossFile`, `pipelineSuffixCrossUnresolvedNames`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
