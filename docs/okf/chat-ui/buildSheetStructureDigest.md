---
type: endpoint
title: buildSheetStructureDigest
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(aoa, sheetName)"
role: "aoa → { text, hasLandmarks, totalRows[] }. 순수 함수(테스트 가능)."
role_source: banner
version: "0.8.0"
loc: "chat-ui.js:3558-3558"

# ── 입출력 ──
inputs:
  - "aoa"
  - "sheetName"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_clarifyCellText"
  - "_clarifyRowHasNumber"
  - "_clarifyRowLeftLabel"
  - "push"
calls_external:
  - "forEach"
  - "join"
  - "map"
  - "slice"
  - "some"
  - "startsWith"
  - "test"
called_by:
  - "clarifyVerifierAskIfNeeded"
  - "explainPipelineErrorForUser"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
aoa → { text, hasLandmarks, totalRows[] }. 순수 함수(테스트 가능).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_clarifyCellText`, `_clarifyRowHasNumber`, `_clarifyRowLeftLabel`, `push`
- 피호출(영향 전파 경로): `clarifyVerifierAskIfNeeded`, `explainPipelineErrorForUser`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
