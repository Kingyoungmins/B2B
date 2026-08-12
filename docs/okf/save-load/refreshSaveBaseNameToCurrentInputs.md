---
type: endpoint
title: refreshSaveBaseNameToCurrentInputs
module: save-load.js
lang: js
extraction: regex   # 정규식 근사
signature: "(name)"
role: "[지난달 이름 갱신] 불러온 스킬에는 '그 스킬을 만들 때 쓴 파일 이름'(예: ..._2026_4월)이 저장돼"
role_source: banner
version: "0.7.3"
loc: "save-load.js:94-94"

# ── 입출력 ──
inputs:
  - "name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "pipelineStableWorkbookKey"
  - "workbookDisplayName"
calls_external:
  - "Set"
  - "String"
  - "filter"
  - "from"
  - "map"
  - "replace"
  - "trim"
called_by:
  - "currentLogicSaveBaseName"
reads:
  - "state.inputs"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
[지난달 이름 갱신] 불러온 스킬에는 '그 스킬을 만들 때 쓴 파일 이름'(예: ..._2026_4월)이 저장돼

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `pipelineStableWorkbookKey`, `workbookDisplayName`
- 피호출(영향 전파 경로): `currentLogicSaveBaseName`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
