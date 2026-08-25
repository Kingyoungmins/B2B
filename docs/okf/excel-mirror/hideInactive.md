---
type: endpoint
title: hideInactive
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(options = {})"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "excel-mirror.js:2332-2332"

# ── 입출력 ──
inputs:
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
  - "상태 변경: excelMirror.lastHideInactiveAt"
raises: []

# ── 유기적 관계 ──
calls:
  - "hasSessions"
  - "invalidateExcelMirrorPositionTracking"
  - "isMissingExcelSessionError"
  - "postExcelMirror"
calls_external:
  - "now"
  - "warn"
called_by:
  - "installOverlayAutoHide"
  - "scheduleHideInactive"
reads: []
writes:
  - "excelMirror.lastHideInactiveAt"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 네트워크/서버 호출
- 상태 변경: excelMirror.lastHideInactiveAt
- 변경 상태 `excelMirror.lastHideInactiveAt` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `hasSessions`, `invalidateExcelMirrorPositionTracking`, `isMissingExcelSessionError`, `postExcelMirror`
- 피호출(영향 전파 경로): `installOverlayAutoHide`, `scheduleHideInactive`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
