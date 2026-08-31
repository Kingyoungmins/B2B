---
type: endpoint
title: installOverlayAutoHide
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "앱이 포커스를 잃으면(최소화 / 파일 대화상자 / 다른 앱 전환) overlay Excel 이 위로 튀어나오지"
role_source: banner
version: "0.8.2"
loc: "excel-mirror.js:2422-2422"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "네트워크/서버 호출"
  - "상태 변경: excelMirror.autoHideInstalled, excelMirror.hideTimer, excelMirror.hostActive, excelMirror.lastHideInactiveAt"
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls:
  - "clearHideTimer"
  - "hasSessions"
  - "hideInactive"
  - "invalidateExcelMirrorPositionTracking"
  - "isMissingExcelSessionError"
  - "postExcelMirror"
  - "restoreActiveExcelMirrorWindow"
  - "restoreSoon"
  - "scheduleHideInactive"
calls_external:
  - "addEventListener"
  - "clearTimeout"
  - "getAttribute"
  - "keys"
  - "now"
  - "setInterval"
  - "setTimeout"
  - "warn"
called_by: []
reads: []
writes:
  - "excelMirror.autoHideInstalled"
  - "excelMirror.hideTimer"
  - "excelMirror.hostActive"
  - "excelMirror.lastHideInactiveAt"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
앱이 포커스를 잃으면(최소화 / 파일 대화상자 / 다른 앱 전환) overlay Excel 이 위로 튀어나오지

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 네트워크/서버 호출
- 상태 변경: excelMirror.autoHideInstalled, excelMirror.hideTimer, excelMirror.hostActive, excelMirror.lastHideInactiveAt
- 타이머
- 변경 상태 `excelMirror.autoHideInstalled, excelMirror.hideTimer, excelMirror.hostActive, excelMirror.lastHideInactiveAt` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `clearHideTimer`, `hasSessions`, `hideInactive`, `invalidateExcelMirrorPositionTracking`, `isMissingExcelSessionError`, `postExcelMirror`, `restoreActiveExcelMirrorWindow`, `restoreSoon`, `scheduleHideInactive`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
