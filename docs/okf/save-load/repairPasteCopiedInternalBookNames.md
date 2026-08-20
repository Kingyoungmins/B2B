---
type: endpoint
title: repairPasteCopiedInternalBookNames
module: save-load.js
lang: js
extraction: regex   # 정규식 근사
signature: "(steps)"
role: "[SBAGENT-209] 복붙 캡처가 코드에 박아 저장한 '내부 작업본 이름' 수리(구버전 저장 스킬 하위호환)."
role_source: banner
version: "0.7.4"
loc: "save-load.js:691-691"

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
  - "isInternalTempWorkbookName"
calls_external:
  - "Map"
  - "Set"
  - "String"
  - "from"
  - "get"
  - "has"
  - "isArray"
  - "replace"
  - "set"
  - "slice"
  - "startsWith"
  - "test"
  - "toLowerCase"
  - "trim"
called_by:
  - "loadLogicFiles"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[SBAGENT-209] 복붙 캡처가 코드에 박아 저장한 '내부 작업본 이름' 수리(구버전 저장 스킬 하위호환).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `isInternalTempWorkbookName`
- 피호출(영향 전파 경로): `loadLogicFiles`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
