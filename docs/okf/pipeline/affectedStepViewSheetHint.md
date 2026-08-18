---
type: endpoint
title: affectedStepViewSheetHint
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(affected)"
role: "[필드 추가#1] 토글/삭제 후 뷰 이동 대상: 스킬 코드가 다른 파일(출력)에 쓰는 교차 파일"
role_source: banner
version: "0.7.4"
loc: "pipeline.js:5735-5735"

# ── 입출력 ──
inputs:
  - "affected"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "match"
  - "read"
called_by:
  - "_reconcilePipelineSimulationAfterEditImpl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[필드 추가#1] 토글/삭제 후 뷰 이동 대상: 스킬 코드가 다른 파일(출력)에 쓰는 교차 파일

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_reconcilePipelineSimulationAfterEditImpl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
