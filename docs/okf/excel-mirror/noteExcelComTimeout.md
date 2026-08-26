---
type: endpoint
title: noteExcelComTimeout
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(err)"
role: "---- COM 응답불능(행) 자동 복구: 단일 Excel 인스턴스의 유일한 약점 보호 ----"
role_source: banner
version: "0.8.0"
loc: "excel-mirror.js:1278-1278"

# ── 입출력 ──
inputs:
  - "err"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: excelMirror.comTimeoutTimes, excelMirror.forceRestartCooldownUntil"
raises: []

# ── 유기적 관계 ──
calls:
  - "forceRestartExcelMirrors"
  - "push"
calls_external:
  - "String"
  - "filter"
  - "now"
  - "test"
called_by:
  - "postExcelMirror"
reads: []
writes:
  - "excelMirror.comTimeoutTimes"
  - "excelMirror.forceRestartCooldownUntil"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
---- COM 응답불능(행) 자동 복구: 단일 Excel 인스턴스의 유일한 약점 보호 ----

## 사이드이펙트 & 주의
- 상태 변경: excelMirror.comTimeoutTimes, excelMirror.forceRestartCooldownUntil
- 변경 상태 `excelMirror.comTimeoutTimes, excelMirror.forceRestartCooldownUntil` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `forceRestartExcelMirrors`, `push`
- 피호출(영향 전파 경로): `postExcelMirror`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
