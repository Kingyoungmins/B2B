---
type: endpoint
title: loadOutputTemplates
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(files)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.1"
loc: "drop-handling.js:206-206"

# ── 입출력 ──
inputs:
  - "files"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: activeOutputIndex, output, outputOriginal"
raises: []

# ── 유기적 관계 ──
calls:
  - "activateOutputTemplate"
  - "beginUiBusy"
  - "beginUpload"
  - "endUiBusy"
  - "ensureWorkbookDisplayName"
  - "finishUpload"
  - "makeOutputTemplate"
  - "openExcelMirrorForFileId"
  - "parseFile"
  - "parseFileWithBackendPreview"
  - "preopenAllExcelMirrors"
  - "prepareMemoryForFileUpload"
  - "push"
  - "refreshChatState"
  - "refreshTabs"
  - "renderOutputChip"
  - "setCurrentView"
  - "toast"
  - "updateUpload"
calls_external:
  - "Promise"
  - "error"
  - "splice"
called_by: []
reads:
  - "state.activeOutputIndex"
  - "state.currentFileId"
  - "state.output"
  - "state.outputOriginal"
  - "state.outputTemplates"
writes:
  - "activeOutputIndex"
  - "output"
  - "outputOriginal"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경: activeOutputIndex, output, outputOriginal
- 변경 상태 `activeOutputIndex, output, outputOriginal` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `activateOutputTemplate`, `beginUiBusy`, `beginUpload`, `endUiBusy`, `ensureWorkbookDisplayName`, `finishUpload`, `makeOutputTemplate`, `openExcelMirrorForFileId`, `parseFile`, `parseFileWithBackendPreview`, `preopenAllExcelMirrors`, `prepareMemoryForFileUpload`, `push`, `refreshChatState`, `refreshTabs`, `renderOutputChip`, `setCurrentView`, `toast`, `updateUpload`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
