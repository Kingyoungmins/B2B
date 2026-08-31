---
type: endpoint
title: pipelineForSave
module: save-load.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "[치환본 저장 방지] 실행 중에는 state.pipeline 이 '매핑본'(실제 파일/시트명으로 치환된 사본)으로"
role_source: banner
version: "0.8.2"
loc: "save-load.js:179-179"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "restore"
  - "traceClientUiEvent"
calls_external:
  - "Map"
  - "String"
  - "get"
  - "isArray"
  - "map"
called_by:
  - "buildLogicZipEntries"
reads:
  - "state.pipeline"
  - "state.pipelineMappedDuringRun"
  - "state.pipelineOriginalDuringRun"
  - "state.runnerMappingRunActive"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
[치환본 저장 방지] 실행 중에는 state.pipeline 이 '매핑본'(실제 파일/시트명으로 치환된 사본)으로

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `restore`, `traceClientUiEvent`
- 피호출(영향 전파 경로): `buildLogicZipEntries`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
