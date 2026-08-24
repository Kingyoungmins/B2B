---
type: endpoint
title: sheetCanonOf
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(cfgFile, sheet)"
role: "[시트도 동일 원칙] 시트명에 월이 박힌 경우(\"원가_4월\", \"202605_..._P\")도 정본 시트로 정규화."
role_source: banner
version: "0.7.5"
loc: "drop-handling.js:639-639"

# ── 입출력 ──
inputs:
  - "cfgFile"
  - "sheet"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "runnerMappingNorm"
  - "stable"
calls_external:
  - "filter"
  - "isArray"
  - "some"
called_by:
  - "runnerCanonicalizeRequirementsByEnv"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
[시트도 동일 원칙] 시트명에 월이 박힌 경우("원가_4월", "202605_..._P")도 정본 시트로 정규화.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `runnerMappingNorm`, `stable`
- 피호출(영향 전파 경로): `runnerCanonicalizeRequirementsByEnv`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
