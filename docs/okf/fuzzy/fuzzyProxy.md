---
type: endpoint
title: fuzzyProxy
module: fuzzy.js
lang: js
extraction: regex   # 정규식 근사
signature: "(target, options)"
role: "inputs / sheets / 컬럼맵 등을 fuzzy lookup이 가능한 Proxy로 감싼다."
role_source: banner
version: "0.5.18"
loc: "fuzzy.js:95-95"

# ── 입출력 ──
inputs:
  - "target"
  - "options"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_normalize"
  - "fuzzyMatch"
calls_external:
  - "Proxy"
  - "String"
  - "call"
  - "get"
  - "getOwnPropertyDescriptor"
  - "has"
  - "keys"
  - "onAmbiguous"
  - "onResolve"
  - "ownKeys"
  - "set"
called_by:
  - "computeStateBeforeStep"
  - "runPipeline"
  - "runSteps"
  - "wrapSheets"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
inputs / sheets / 컬럼맵 등을 fuzzy lookup이 가능한 Proxy로 감싼다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_normalize`, `fuzzyMatch`
- 피호출(영향 전파 경로): `computeStateBeforeStep`, `runPipeline`, `runSteps`, `wrapSheets`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
