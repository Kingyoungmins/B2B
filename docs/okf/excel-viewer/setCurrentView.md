---
type: endpoint
title: setCurrentView
module: excel-viewer.js
lang: js
extraction: regex   # 정규식 근사
signature: "(fileId, options = {})"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "excel-viewer.js:105-105"

# ── 입출력 ──
inputs:
  - "fileId"
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: currentFileId, currentSheet, selectedSheets"
raises: []

# ── 유기적 관계 ──
calls:
  - "activateOutputTemplate"
  - "getFile"
  - "isExplicitViewSwitchSource"
  - "outputTemplateFileId"
  - "outputTemplateIndexFromFileId"
  - "refreshTabs"
  - "renderExcelViewer"
  - "renderInputList"
  - "renderOutputChip"
calls_external:
  - "includes"
  - "startsWith"
called_by:
  - "landAppTabOnExcelSession"
  - "loadOutputTemplates"
  - "openExcelMirrorForFileId"
  - "openExcelMirrorResultForFileId"
  - "preopenAllExcelMirrors"
  - "switchWorkbookFileFromUserTab"
reads:
  - "state.activeOutputIndex"
  - "state.currentFileId"
  - "state.currentSheet"
  - "state.outputTemplates"
  - "state.selectedSheets"
writes:
  - "currentFileId"
  - "currentSheet"
  - "selectedSheets"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경: currentFileId, currentSheet, selectedSheets
- 변경 상태 `currentFileId, currentSheet, selectedSheets` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `activateOutputTemplate`, `getFile`, `isExplicitViewSwitchSource`, `outputTemplateFileId`, `outputTemplateIndexFromFileId`, `refreshTabs`, `renderExcelViewer`, `renderInputList`, `renderOutputChip`
- 피호출(영향 전파 경로): `landAppTabOnExcelSession`, `loadOutputTemplates`, `openExcelMirrorForFileId`, `openExcelMirrorResultForFileId`, `preopenAllExcelMirrors`, `switchWorkbookFileFromUserTab`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
