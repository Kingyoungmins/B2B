---
type: endpoint
title: currentInputSignature
module: save-load.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "[A안: 입력 바뀌면 이름도 따라오게] '기억된 저장 이름'은 그 이름을 만든 '입력 파일 세트'에 묶는다."
role_source: banner
version: "0.7.5"
loc: "save-load.js:72-72"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "workbookDisplayName"
calls_external:
  - "String"
  - "filter"
  - "join"
  - "map"
  - "replace"
  - "sort"
  - "toLowerCase"
  - "trim"
called_by:
  - "currentLogicSaveBaseName"
  - "rememberLogicSaveBaseName"
reads:
  - "state.inputs"
  - "state.output"
  - "state.outputTemplates"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
[A안: 입력 바뀌면 이름도 따라오게] '기억된 저장 이름'은 그 이름을 만든 '입력 파일 세트'에 묶는다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `workbookDisplayName`
- 피호출(영향 전파 경로): `currentLogicSaveBaseName`, `rememberLogicSaveBaseName`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
