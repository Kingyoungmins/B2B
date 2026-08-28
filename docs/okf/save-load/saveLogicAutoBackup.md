---
type: endpoint
title: saveLogicAutoBackup
module: save-load.js
lang: js
extraction: regex   # 정규식 근사
signature: "(reason, seq)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.1"
loc: "save-load.js:430-430"

# ── 입출력 ──
inputs:
  - "reason"
  - "seq"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "네트워크/서버 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "buildLogicZipEntries"
  - "createZipBlob"
  - "defaultLogicBaseNameFromInputs"
  - "timestampedLogicArchiveName"
  - "toast"
  - "traceClientUiEvent"
calls_external:
  - "Error"
  - "String"
  - "encodeURIComponent"
  - "fetch"
  - "info"
  - "json"
  - "now"
  - "slice"
  - "warn"
called_by:
  - "scheduleLogicAutoBackup"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 네트워크/서버 호출

## 관계
- 호출: `buildLogicZipEntries`, `createZipBlob`, `defaultLogicBaseNameFromInputs`, `timestampedLogicArchiveName`, `toast`, `traceClientUiEvent`
- 피호출(영향 전파 경로): `scheduleLogicAutoBackup`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
