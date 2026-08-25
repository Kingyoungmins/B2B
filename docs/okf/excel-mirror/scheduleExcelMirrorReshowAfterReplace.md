---
type: endpoint
title: scheduleExcelMirrorReshowAfterReplace
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(excelId, delay = 700, attempt = 0)"
role: "[제보 2026-08-24 회색 화면] /api/excel/replace 는 워크북을 닫고 다시 열어 SDI 프레임이 새로"
role_source: banner
version: "0.8.0"
loc: "excel-mirror.js:1486-1486"

# ── 입출력 ──
inputs:
  - "excelId"
  - "delay = 700"
  - "attempt = 0"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: excelMirror.replaceReshowTimers"
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls:
  - "currentExcelId"
  - "showOnlyExcelMirrorWindow"
  - "traceClientUiEvent"
calls_external:
  - "Number"
  - "String"
  - "clearTimeout"
  - "false"
  - "max"
  - "now"
  - "setTimeout"
  - "slice"
  - "then"
  - "trace"
called_by:
  - "_restoreSnapshotByIds"
reads: []
writes:
  - "excelMirror.replaceReshowTimers"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[제보 2026-08-24 회색 화면] /api/excel/replace 는 워크북을 닫고 다시 열어 SDI 프레임이 새로

## 사이드이펙트 & 주의
- 상태 변경: excelMirror.replaceReshowTimers
- 타이머
- 변경 상태 `excelMirror.replaceReshowTimers` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `currentExcelId`, `showOnlyExcelMirrorWindow`, `traceClientUiEvent`
- 피호출(영향 전파 경로): `_restoreSnapshotByIds`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
