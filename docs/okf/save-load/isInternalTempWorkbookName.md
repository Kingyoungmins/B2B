---
type: endpoint
title: isInternalTempWorkbookName
module: save-load.js
lang: js
extraction: regex   # 정규식 근사
signature: "(name)"
role: "[SBAGENT-209] 순수 내부 작업본 이름인지 — excel_open_<hash>.xls 처럼 원본명이 전혀 안 남은 형태만."
role_source: banner
version: "0.8.1"
loc: "save-load.js:700-700"

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
  - "test"
called_by:
  - "repairPasteCopiedInternalBookNames"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
[SBAGENT-209] 순수 내부 작업본 이름인지 — excel_open_<hash>.xls 처럼 원본명이 전혀 안 남은 형태만.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `repairPasteCopiedInternalBookNames`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
