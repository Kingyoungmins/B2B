---
type: endpoint
title: preopenAllExcelMirrors
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(selectedFileId, options = {})"
role: "업로드 직후: 모든 파일의 미러를 미리 열어 같은 위치에 스택해 둔다."
role_source: banner
version: "0.8.1"
loc: "excel-mirror.js:700-700"

# ── 입출력 ──
inputs:
  - "selectedFileId"
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: excelMirror.hostActive, excelMirror.preopenSeq, excelMirror.preopening"
raises: []

# ── 유기적 관계 ──
calls:
  - "ensureExcelMirrorSession"
  - "excelMirrorAllowsViewSwitch"
  - "isMissingExcelSessionError"
  - "listAllWorkbookFileIds"
  - "publishNativeExcelLoading"
  - "push"
  - "scheduleExcelMirrorBaselinePoll"
  - "setCurrentView"
  - "setUiBusySuffix"
  - "showOnlyExcelMirrorWindow"
  - "startExcelMirrorPolling"
  - "toast"
  - "updateMirrorShellStatus"
  - "updateUiBusyLabel"
calls_external:
  - "String"
  - "filter"
  - "park"
  - "warn"
called_by:
  - "autoOpenMirrorAfterUpload"
  - "forceRestartExcelMirrors"
  - "loadInputFiles"
  - "loadOutputTemplates"
  - "restoreSoftRefreshSnapshot"
reads:
  - "state.currentFileId"
writes:
  - "excelMirror.hostActive"
  - "excelMirror.preopenSeq"
  - "excelMirror.preopening"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
업로드 직후: 모든 파일의 미러를 미리 열어 같은 위치에 스택해 둔다.

## 사이드이펙트 & 주의
- 상태 변경: excelMirror.hostActive, excelMirror.preopenSeq, excelMirror.preopening
- 변경 상태 `excelMirror.hostActive, excelMirror.preopenSeq, excelMirror.preopening` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `ensureExcelMirrorSession`, `excelMirrorAllowsViewSwitch`, `isMissingExcelSessionError`, `listAllWorkbookFileIds`, `publishNativeExcelLoading`, `push`, `scheduleExcelMirrorBaselinePoll`, `setCurrentView`, `setUiBusySuffix`, `showOnlyExcelMirrorWindow`, `startExcelMirrorPolling`, `toast`, `updateMirrorShellStatus`, `updateUiBusyLabel`
- 피호출(영향 전파 경로): `autoOpenMirrorAfterUpload`, `forceRestartExcelMirrors`, `loadInputFiles`, `loadOutputTemplates`, `restoreSoftRefreshSnapshot`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
