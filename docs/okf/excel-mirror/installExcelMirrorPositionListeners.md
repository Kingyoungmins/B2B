---
type: endpoint
title: installExcelMirrorPositionListeners
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "excel-mirror.js:1938-1938"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "상태 변경: excelMirror.positionListenersInstalled, excelMirror.uiClickGuardUntil"
raises: []

# ── 유기적 관계 ──
calls:
  - "currentExcelId"
  - "isNativeExcelOverlayShell"
  - "scheduleExcelMirrorPosition"
  - "scheduleRestoreActiveExcelMirror"
calls_external:
  - "addEventListener"
  - "closest"
  - "now"
called_by:
  - "setupExcelMirrorControls"
reads: []
writes:
  - "excelMirror.positionListenersInstalled"
  - "excelMirror.uiClickGuardUntil"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 상태 변경: excelMirror.positionListenersInstalled, excelMirror.uiClickGuardUntil
- 변경 상태 `excelMirror.positionListenersInstalled, excelMirror.uiClickGuardUntil` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `currentExcelId`, `isNativeExcelOverlayShell`, `scheduleExcelMirrorPosition`, `scheduleRestoreActiveExcelMirror`
- 피호출(영향 전파 경로): `setupExcelMirrorControls`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
