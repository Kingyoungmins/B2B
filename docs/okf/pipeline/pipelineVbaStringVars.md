---
type: endpoint
title: pipelineVbaStringVars
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code)"
role: "VBA 문자열 변수 맵: `x = \"A.xlsx\"` / `Dim x As String: x = \"A.xlsx\"` / `Const x = \"A.xlsx\"`."
role_source: banner
version: "0.8.0"
loc: "pipeline.js:622-622"

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
  - "Map"
  - "String"
  - "exec"
  - "isCompare"
  - "set"
  - "split"
  - "test"
  - "toLowerCase"
called_by:
  - "pipelineVbaTargetWorkbookNames"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
VBA 문자열 변수 맵: `x = "A.xlsx"` / `Dim x As String: x = "A.xlsx"` / `Const x = "A.xlsx"`.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `pipelineVbaTargetWorkbookNames`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
