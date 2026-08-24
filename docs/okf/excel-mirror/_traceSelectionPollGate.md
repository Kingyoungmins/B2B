---
type: endpoint
title: _traceSelectionPollGate
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(excelId, reason, extra)"
role: "[0.5.17] 현재 탭의 Selection 만 가볍게 읽어 선택→채팅 반영을 빠르게 한다. active-sync(탭 따라가기)는"
role_source: banner
version: "0.7.5"
loc: "excel-mirror.js:1706-1706"

# ── 입출력 ──
inputs:
  - "excelId"
  - "reason"
  - "extra"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: excelMirror.selPollLastReasonByExcelId"
raises: []

# ── 유기적 관계 ──
calls:
  - "traceClientUiEvent"
calls_external:
  - "String"
called_by:
  - "pollExcelSelection"
  - "startExcelMirrorPolling"
reads: []
writes:
  - "excelMirror.selPollLastReasonByExcelId"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
[0.5.17] 현재 탭의 Selection 만 가볍게 읽어 선택→채팅 반영을 빠르게 한다. active-sync(탭 따라가기)는

## 사이드이펙트 & 주의
- 상태 변경: excelMirror.selPollLastReasonByExcelId
- 변경 상태 `excelMirror.selPollLastReasonByExcelId` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `traceClientUiEvent`
- 피호출(영향 전파 경로): `pollExcelSelection`, `startExcelMirrorPolling`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
