---
type: endpoint
title: forceRestartExcelMirrors
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(reason)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "excel-mirror.js:1238-1238"

# ── 입출력 ──
inputs:
  - "reason"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
  - "상태 변경: excelMirror.forceRestarting"
raises: []

# ── 유기적 관계 ──
calls:
  - "clearExcelMirrorClientState"
  - "currentExcelId"
  - "invalidateLivePipelineApplied"
  - "maybeAutoReapplyAfterRecover"
  - "preopenAllExcelMirrors"
  - "toast"
calls_external:
  - "fetch"
  - "warn"
called_by:
  - "escalateExcelStopToForceRestart"
  - "noteExcelComTimeout"
reads:
  - "state.currentFileId"
  - "state.inputs"
  - "state.output"
  - "state.outputTemplates"
writes:
  - "excelMirror.forceRestarting"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 네트워크/서버 호출
- 상태 변경: excelMirror.forceRestarting
- 변경 상태 `excelMirror.forceRestarting` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `clearExcelMirrorClientState`, `currentExcelId`, `invalidateLivePipelineApplied`, `maybeAutoReapplyAfterRecover`, `preopenAllExcelMirrors`, `toast`
- 피호출(영향 전파 경로): `escalateExcelStopToForceRestart`, `noteExcelComTimeout`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
