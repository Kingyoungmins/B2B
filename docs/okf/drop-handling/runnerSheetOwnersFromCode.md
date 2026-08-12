---
type: endpoint
title: runnerSheetOwnersFromCode
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code)"
role: "코드에서 '어떤 시트가 어떤 워크북 소유인지' (book,sheet) 쌍을 뽑는다(교차파일 오귀속 방지 + 자기 시트 회수)."
role_source: banner
version: "0.7.3"
loc: "drop-handling.js:1154-1154"

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
  - "add"
  - "push"
  - "runnerLooksLikeA1Address"
  - "runnerMappingNorm"
  - "runnerPyBookVarMap"
  - "runnerRecordedActivatePairs"
calls_external:
  - "Map"
  - "RegExp"
  - "Set"
  - "Sheets"
  - "String"
  - "Windows"
  - "book"
  - "delete_rows"
  - "exec"
  - "forEach"
  - "get"
  - "has"
  - "replace"
  - "set"
  - "toLowerCase"
called_by:
  - "runnerExtractMappingRequirements"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
코드에서 '어떤 시트가 어떤 워크북 소유인지' (book,sheet) 쌍을 뽑는다(교차파일 오귀속 방지 + 자기 시트 회수).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `push`, `runnerLooksLikeA1Address`, `runnerMappingNorm`, `runnerPyBookVarMap`, `runnerRecordedActivatePairs`
- 피호출(영향 전파 경로): `runnerExtractMappingRequirements`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
