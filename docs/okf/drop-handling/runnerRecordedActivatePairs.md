---
type: endpoint
title: runnerRecordedActivatePairs
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code)"
role: "[녹화 관용구 (파일,시트) 쌍] MS 매크로 레코더 출력은 Workbooks(\"X\").Worksheets(\"Y\") 대신"
role_source: banner
version: "0.7.4"
loc: "drop-handling.js:1077-1077"

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
  - "push"
calls_external:
  - "String"
  - "match"
  - "split"
called_by:
  - "runnerAddPairedCodeRequirements"
  - "runnerSheetOwnersFromCode"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[녹화 관용구 (파일,시트) 쌍] MS 매크로 레코더 출력은 Workbooks("X").Worksheets("Y") 대신

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `push`
- 피호출(영향 전파 경로): `runnerAddPairedCodeRequirements`, `runnerSheetOwnersFromCode`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
