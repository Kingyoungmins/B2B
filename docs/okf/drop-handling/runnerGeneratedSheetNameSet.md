---
type: endpoint
title: runnerGeneratedSheetNameSet
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(steps)"
role: "[생성시트 오매칭 방어] 이 스킬이 실행 중 만드는 시트 이름 전부(책 구분 없이 이름만)."
role_source: banner
version: "0.8.0"
loc: "drop-handling.js:1456-1456"

# ── 입출력 ──
inputs:
  - "steps"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "runnerExtractGeneratedSheetsFromCode"
  - "runnerMappingNorm"
calls_external:
  - "Set"
  - "forEach"
called_by:
  - "runnerBuildMappingRows"
  - "runnerRenderMappingPanel"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[생성시트 오매칭 방어] 이 스킬이 실행 중 만드는 시트 이름 전부(책 구분 없이 이름만).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `runnerExtractGeneratedSheetsFromCode`, `runnerMappingNorm`
- 피호출(영향 전파 경로): `runnerBuildMappingRows`, `runnerRenderMappingPanel`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
