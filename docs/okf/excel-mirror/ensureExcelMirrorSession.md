---
type: endpoint
title: ensureExcelMirrorSession
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(fileId, { makeActive = false, deferVisible = false } = {})"
role: "지정한 파일의 미러 세션을 보장(없으면 연다). 활성화/최상단 올리기는 makeActive 일 때만."
role_source: banner
version: "0.7.5"
loc: "excel-mirror.js:575-575"

# ── 입출력 ──
inputs:
  - "fileId"
  - "{ makeActive = false"
  - "deferVisible = false } = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
  - "상태 변경: excelMirror.activeExcelId"
raises: []

# ── 유기적 관계 ──
calls:
  - "excelMirrorScreenRect"
  - "extractResultIdFromDownloadUrl"
  - "getFile"
  - "hideAllExcelMirrorWindows"
  - "isBackendResultDownloadUrl"
  - "pollExcelMirrorChanges"
  - "positionExcelMirrorWindow"
  - "postExcelMirror"
  - "showOnlyExcelMirrorWindow"
  - "stabilizeExcelMirrorZOrder"
calls_external:
  - "Error"
  - "now"
called_by:
  - "openExcelMirrorForFileId"
  - "preopenAllExcelMirrors"
  - "switchVisibleExcelMirrorToFileId"
reads: []
writes:
  - "excelMirror.activeExcelId"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
지정한 파일의 미러 세션을 보장(없으면 연다). 활성화/최상단 올리기는 makeActive 일 때만.

## 사이드이펙트 & 주의
- 네트워크/서버 호출
- 상태 변경: excelMirror.activeExcelId
- 변경 상태 `excelMirror.activeExcelId` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `excelMirrorScreenRect`, `extractResultIdFromDownloadUrl`, `getFile`, `hideAllExcelMirrorWindows`, `isBackendResultDownloadUrl`, `pollExcelMirrorChanges`, `positionExcelMirrorWindow`, `postExcelMirror`, `showOnlyExcelMirrorWindow`, `stabilizeExcelMirrorZOrder`
- 피호출(영향 전파 경로): `openExcelMirrorForFileId`, `preopenAllExcelMirrors`, `switchVisibleExcelMirrorToFileId`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
