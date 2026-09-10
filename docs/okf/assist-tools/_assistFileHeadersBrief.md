---
type: endpoint
title: _assistFileHeadersBrief
module: assist-tools.js
lang: js
extraction: regex   # 정규식 근사
signature: "(maxCols)"
role: "실측: 팩트에 파일명만 있으니 모델이 'Sheet1' 을 추측하고, 이미 '마진율' 열이 있는 요약 시트를 두고 원본 두 파일을 뒤졌다."
role_source: banner
version: "0.8.4"
loc: "assist-tools.js:213-213"

# ── 입출력 ──
inputs:
  - "maxCols"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_assistDetectHeaderRow"
  - "add"
  - "push"
calls_external:
  - "Set"
  - "String"
  - "filter"
  - "forEach"
  - "isArray"
  - "keys"
  - "map"
  - "slice"
  - "trim"
called_by:
  - "assistSystemPrompt"
reads:
  - "state.inputs"
  - "state.outputTemplates"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.4-gen"
---

## 역할
실측: 팩트에 파일명만 있으니 모델이 'Sheet1' 을 추측하고, 이미 '마진율' 열이 있는 요약 시트를 두고 원본 두 파일을 뒤졌다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_assistDetectHeaderRow`, `add`, `push`
- 피호출(영향 전파 경로): `assistSystemPrompt`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
