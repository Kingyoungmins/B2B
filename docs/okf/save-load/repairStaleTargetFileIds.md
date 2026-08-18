---
type: endpoint
title: repairStaleTargetFileIds
module: save-load.js
lang: js
extraction: regex   # 정규식 근사
signature: "(steps, envConfig)"
role: "[로드 시] 이미 저장된 zip 의 혼재도 수리한다. envConfig.inputs(저장 시점 업로드 '정본')에 없는"
role_source: banner
version: "0.7.4"
loc: "save-load.js:750-750"

# ── 입출력 ──
inputs:
  - "steps"
  - "envConfig"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "keyOf"
  - "pipelineStableWorkbookKey"
calls_external:
  - "Set"
  - "String"
  - "filter"
  - "has"
  - "isArray"
  - "map"
  - "slice"
  - "startsWith"
  - "toLowerCase"
  - "trim"
called_by:
  - "loadLogic"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[로드 시] 이미 저장된 zip 의 혼재도 수리한다. envConfig.inputs(저장 시점 업로드 '정본')에 없는

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `keyOf`, `pipelineStableWorkbookKey`
- 피호출(영향 전파 경로): `loadLogic`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
