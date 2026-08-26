---
type: endpoint
title: runnerPyBookVarMap
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(src)"
role: "`VAR = ctx.book(<리터럴 또는 변수>)` 를 { VAR: \"실제 파일명\" } 으로 푼다."
role_source: banner
version: "0.8.0"
loc: "drop-handling.js:812-812"

# ── 입출력 ──
inputs:
  - "src"
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
  - "b"
  - "exec"
  - "get"
  - "resolve"
  - "set"
  - "split"
  - "test"
  - "trim"
called_by:
  - "runnerAddPairedCodeRequirements"
  - "runnerExtractGeneratedSheetsFromCode"
  - "runnerSheetOwnersFromCode"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
`VAR = ctx.book(<리터럴 또는 변수>)` 를 { VAR: "실제 파일명" } 으로 푼다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `runnerAddPairedCodeRequirements`, `runnerExtractGeneratedSheetsFromCode`, `runnerSheetOwnersFromCode`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
