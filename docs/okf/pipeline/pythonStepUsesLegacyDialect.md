---
type: endpoint
title: pythonStepUsesLegacyDialect
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code)"
role: "[혼합 호환] 레거시 python 방언 감지 — 구버전 openpyxl ctx 헬퍼(rows/sheet/value/write_grid…),"
role_source: banner
version: "0.7.3"
loc: "pipeline.js:82-82"

# ── 입출력 ──
inputs:
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "test"
called_by:
  - "pipelineMixesLivePythonAndVba"
  - "pipelineStepLiveLanguage"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
[혼합 호환] 레거시 python 방언 감지 — 구버전 openpyxl ctx 헬퍼(rows/sheet/value/write_grid…),

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `pipelineMixesLivePythonAndVba`, `pipelineStepLiveLanguage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
