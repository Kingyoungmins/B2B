---
type: endpoint
title: pipelinePythonBookVarNames
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code)"
role: "VAR = ctx.book(\"X\" | 변수)  ->  { VAR: \"X\" }"
role_source: banner
version: "0.7.3"
loc: "pipeline.js:739-739"

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
  - "pipelineConstStringVars"
  - "pipelineResolvePyArg"
calls_external:
  - "String"
  - "exec"
called_by:
  - "pipelinePythonMutatedBookNames"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
VAR = ctx.book("X" | 변수)  ->  { VAR: "X" }

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `pipelineConstStringVars`, `pipelineResolvePyArg`
- 피호출(영향 전파 경로): `pipelinePythonMutatedBookNames`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
