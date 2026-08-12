---
type: endpoint
title: computeStateBeforeStep
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(stepIdx)"
role: "특정 step 직전(=steps[0..stepIdx-1] 이 적용된) 입력/출력 상태를 계산해서 반환."
role_source: banner
version: "0.7.3"
loc: "pipeline.js:2645-2645"

# ── 입출력 ──
inputs:
  - "stepIdx"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "cloneFileRecord"
  - "deepClone"
  - "fuzzyProxy"
  - "isStepEnabled"
  - "wrapSheets"
calls_external:
  - "Error"
  - "Function"
  - "Number"
  - "String"
  - "fn"
  - "forEach"
  - "includes"
  - "isArray"
  - "keys"
  - "max"
  - "replace"
  - "slice"
  - "startsWith"
  - "toLowerCase"
  - "transform"
  - "trim"
  - "warn"
called_by:
  - "buildEditingContext"
reads:
  - "state.fuzzyResolution"
  - "state.inputsOriginal"
  - "state.outputOriginal"
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
특정 step 직전(=steps[0..stepIdx-1] 이 적용된) 입력/출력 상태를 계산해서 반환.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `cloneFileRecord`, `deepClone`, `fuzzyProxy`, `isStepEnabled`, `wrapSheets`
- 피호출(영향 전파 경로): `buildEditingContext`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
