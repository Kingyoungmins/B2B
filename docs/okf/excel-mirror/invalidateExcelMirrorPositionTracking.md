---
type: endpoint
title: invalidateExcelMirrorPositionTracking
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(excelId)"
role: "미러를 숨기면(park) 위치 추적을 무효화해, 다음 전환 시 다시 배치되도록 한다."
role_source: banner
version: "0.7.3"
loc: "excel-mirror.js:1917-1917"

# ── 입출력 ──
inputs:
  - "excelId"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: excelMirror.positionedKeyByExcelId"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
called_by:
  - "hideAllExcelMirrorWindows"
  - "hideInactive"
  - "hideInactiveExcelMirrorSessions"
  - "installOverlayAutoHide"
reads: []
writes:
  - "excelMirror.positionedKeyByExcelId"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
미러를 숨기면(park) 위치 추적을 무효화해, 다음 전환 시 다시 배치되도록 한다.

## 사이드이펙트 & 주의
- 상태 변경: excelMirror.positionedKeyByExcelId
- 변경 상태 `excelMirror.positionedKeyByExcelId` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `hideAllExcelMirrorWindows`, `hideInactive`, `hideInactiveExcelMirrorSessions`, `installOverlayAutoHide`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
