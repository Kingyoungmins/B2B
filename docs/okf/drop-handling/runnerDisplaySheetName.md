---
type: endpoint
title: runnerDisplaySheetName
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(name)"
role: "[표시명 정리] 확장자와 실제 내용이 다른 위장 파일(예: .xlsx 인데 내용은 구형 .xls/HTML — 한전"
role_source: banner
version: "0.8.0"
loc: "drop-handling.js:1604-1604"

# ── 입출력 ──
inputs:
  - "name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "replace"
called_by:
  - "runnerRenderMappingPanel"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[표시명 정리] 확장자와 실제 내용이 다른 위장 파일(예: .xlsx 인데 내용은 구형 .xls/HTML — 한전

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `runnerRenderMappingPanel`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
