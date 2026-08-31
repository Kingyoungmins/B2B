---
type: endpoint
title: runnerGroupMappingRowsByFile
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(rows)"
role: "per-(book,sheet) 행들을 '파일별 1행'으로 접는다. 한 파일이 여러 시트를 쓰면 그 파일 한 줄에"
role_source: banner
version: "0.8.2"
loc: "drop-handling.js:1630-1630"

# ── 입출력 ──
inputs:
  - "rows"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "push"
  - "runnerMappingNorm"
calls_external:
  - "Map"
  - "every"
  - "filter"
  - "forEach"
  - "get"
  - "map"
  - "set"
  - "some"
called_by:
  - "runnerMappingHasBlockingMissing"
  - "runnerRenderMappingPanel"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
per-(book,sheet) 행들을 '파일별 1행'으로 접는다. 한 파일이 여러 시트를 쓰면 그 파일 한 줄에

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `push`, `runnerMappingNorm`
- 피호출(영향 전파 경로): `runnerMappingHasBlockingMissing`, `runnerRenderMappingPanel`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
