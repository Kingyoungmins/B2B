---
type: endpoint
title: currentLogicSaveBaseName
module: save-load.js
lang: js
extraction: regex   # 정규식 근사
signature: "(fallback)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "save-load.js:110-110"

# ── 입출력 ──
inputs:
  - "fallback"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "localStorage/세션스토리지 접근"
raises: []

# ── 유기적 관계 ──
calls:
  - "currentInputSignature"
  - "refreshSaveBaseNameToCurrentInputs"
  - "stripLogicTimestampSuffix"
calls_external:
  - "fallback"
  - "getItem"
  - "sigOk"
  - "toLowerCase"
  - "trim"
called_by:
  - "_buildLogicZipEntriesImpl"
  - "openSaveModal"
reads:
  - "state.logicSaveBaseName"
  - "state.logicSaveInputSig"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- localStorage/세션스토리지 접근

## 관계
- 호출: `currentInputSignature`, `refreshSaveBaseNameToCurrentInputs`, `stripLogicTimestampSuffix`
- 피호출(영향 전파 경로): `_buildLogicZipEntriesImpl`, `openSaveModal`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
