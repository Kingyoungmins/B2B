---
type: endpoint
title: scheduleExcelMirrorPosition
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(force = false)"
role: "A방식: 단일 Excel 앱 창만 관리하므로 활성 세션 기준으로 한 번만 위치를 보정한다."
role_source: banner
version: "0.7.5"
loc: "excel-mirror.js:2018-2018"

# ── 입출력 ──
inputs:
  - "force = false"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: excelMirror.positionTimer"
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls:
  - "currentExcelId"
  - "isMissingExcelSessionError"
  - "isNativeExcelShell"
  - "positionExcelMirrorWindow"
  - "stabilizeExcelMirrorZOrder"
calls_external:
  - "clearTimeout"
  - "now"
  - "setTimeout"
  - "then"
  - "warn"
called_by:
  - "installExcelMirrorPositionListeners"
reads: []
writes:
  - "excelMirror.positionTimer"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
A방식: 단일 Excel 앱 창만 관리하므로 활성 세션 기준으로 한 번만 위치를 보정한다.

## 사이드이펙트 & 주의
- 상태 변경: excelMirror.positionTimer
- 타이머
- 변경 상태 `excelMirror.positionTimer` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `currentExcelId`, `isMissingExcelSessionError`, `isNativeExcelShell`, `positionExcelMirrorWindow`, `stabilizeExcelMirrorZOrder`
- 피호출(영향 전파 경로): `installExcelMirrorPositionListeners`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
