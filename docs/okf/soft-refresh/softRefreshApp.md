---
type: endpoint
title: softRefreshApp
module: soft-refresh.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "soft-refresh.js:65-65"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "localStorage/세션스토리지 접근"
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls:
  - "closeAllExcelMirrorSessions"
  - "collectSoftRefreshSnapshot"
  - "confirm"
  - "forceCloseAllExcelMirrorSessions"
  - "hideAllExcelMirrorWindows"
  - "openB2bConfirmModal"
  - "pipelineEditBusyReason"
  - "scheduleRestoreActiveExcelMirror"
  - "toast"
calls_external:
  - "Promise"
  - "fromCharCode"
  - "getElementById"
  - "race"
  - "reload"
  - "resolve"
  - "setItem"
  - "setTimeout"
  - "stringify"
  - "warn"
called_by:
  - "bind"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- localStorage/세션스토리지 접근
- 타이머

## 관계
- 호출: `closeAllExcelMirrorSessions`, `collectSoftRefreshSnapshot`, `confirm`, `forceCloseAllExcelMirrorSessions`, `hideAllExcelMirrorWindows`, `openB2bConfirmModal`, `pipelineEditBusyReason`, `scheduleRestoreActiveExcelMirror`, `toast`
- 피호출(영향 전파 경로): `bind`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
