---
type: endpoint
title: pollExcelSelection
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(excelId)"
role: "[0.5.17] 현재 탭의 Selection 만 가볍게 읽어 선택→채팅 반영을 빠르게 한다. active-sync(탭 따라가기)는"
role_source: banner
version: "0.5.18"
loc: "excel-mirror.js:1478-1478"

# ── 입출력 ──
inputs:
  - "excelId"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
  - "상태 변경: excelMirror.selectionPolling"
raises: []

# ── 유기적 관계 ──
calls:
  - "fileIdForExcelMirrorId"
  - "forgetExcelMirrorSession"
  - "isMissingExcelSessionError"
  - "postExcelMirror"
  - "shouldAppendExcelSelectionFromPoll"
  - "syncSelectionFromExcel"
calls_external:
  - "now"
called_by:
  - "startExcelMirrorPolling"
reads:
  - "state.currentFileId"
writes:
  - "excelMirror.selectionPolling"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
[0.5.17] 현재 탭의 Selection 만 가볍게 읽어 선택→채팅 반영을 빠르게 한다. active-sync(탭 따라가기)는

## 사이드이펙트 & 주의
- 네트워크/서버 호출
- 상태 변경: excelMirror.selectionPolling
- 변경 상태 `excelMirror.selectionPolling` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `fileIdForExcelMirrorId`, `forgetExcelMirrorSession`, `isMissingExcelSessionError`, `postExcelMirror`, `shouldAppendExcelSelectionFromPoll`, `syncSelectionFromExcel`
- 피호출(영향 전파 경로): `startExcelMirrorPolling`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
