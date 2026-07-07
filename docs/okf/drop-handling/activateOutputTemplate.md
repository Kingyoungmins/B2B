---
type: endpoint
title: activateOutputTemplate
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(index)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.19"
loc: "drop-handling.js:101-101"

# ── 입출력 ──
inputs:
  - "index"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: activeOutputIndex, currentFileId, currentSheet, output, outputOriginal, selectedSheets"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "includes"
called_by:
  - "loadOutputTemplates"
  - "removeOutputTemplateAt"
  - "setCurrentView"
reads:
  - "state.activeOutputIndex"
  - "state.currentFileId"
  - "state.currentSheet"
  - "state.output"
  - "state.outputOriginal"
  - "state.outputTemplates"
  - "state.selectedSheets"
writes:
  - "activeOutputIndex"
  - "currentFileId"
  - "currentSheet"
  - "output"
  - "outputOriginal"
  - "selectedSheets"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경: activeOutputIndex, currentFileId, currentSheet, output, outputOriginal, selectedSheets
- 변경 상태 `activeOutputIndex, currentFileId, currentSheet, output, outputOriginal, selectedSheets` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `loadOutputTemplates`, `removeOutputTemplateAt`, `setCurrentView`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
