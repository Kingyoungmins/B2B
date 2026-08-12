---
type: endpoint
title: openExcelMirrorForFileId
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(fileId, options = {})"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "excel-mirror.js:504-504"

# ── 입출력 ──
inputs:
  - "fileId"
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "localStorage/세션스토리지 접근"
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls:
  - "ensureExcelMirrorSession"
  - "excelMirrorAllowsViewSwitch"
  - "openCurrentWorkbookInExcel"
  - "recoverExcelMirrorWindow"
  - "setCurrentView"
calls_external:
  - "getItem"
  - "removeItem"
  - "setTimeout"
called_by:
  - "ensureExcelMirrorForFileId"
  - "loadInputFiles"
  - "loadOutputTemplates"
reads:
  - "state.currentFileId"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- localStorage/세션스토리지 접근
- 타이머

## 관계
- 호출: `ensureExcelMirrorSession`, `excelMirrorAllowsViewSwitch`, `openCurrentWorkbookInExcel`, `recoverExcelMirrorWindow`, `setCurrentView`
- 피호출(영향 전파 경로): `ensureExcelMirrorForFileId`, `loadInputFiles`, `loadOutputTemplates`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
