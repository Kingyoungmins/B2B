---
type: endpoint
title: stepHasFullRollbackSnapshots
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(step)"
role: "이 스텝을 되돌리는 데 필요한 사본이 '전부' 있는가 — 대상 파일 + 교차 목적지 전부."
role_source: banner
version: "0.7.4"
loc: "pipeline.js:4473-4473"

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
  - "pipelineStepWritesCrossFile"
  - "stepRuntimeCrossExcelIds"
calls_external:
  - "Set"
  - "every"
  - "filter"
  - "has"
  - "isArray"
  - "map"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
이 스텝을 되돌리는 데 필요한 사본이 '전부' 있는가 — 대상 파일 + 교차 목적지 전부.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `pipelineStepWritesCrossFile`, `stepRuntimeCrossExcelIds`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
