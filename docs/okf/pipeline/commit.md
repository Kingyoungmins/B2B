---
type: endpoint
title: commit
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(save)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "pipeline.js:3534-3534"

# ── 입출력 ──
inputs:
  - "save"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: renamingDraft, renamingStepId"
raises: []

# ── 유기적 관계 ──
calls:
  - "pushHistory"
  - "renderPipeline"
  - "scheduleLogicAutoBackup"
calls_external:
  - "String"
  - "findIndex"
  - "null"
  - "trim"
called_by:
  - "renderPipeline"
reads:
  - "state.pipeline"
  - "state.renamingDraft"
  - "state.renamingStepId"
writes:
  - "renamingDraft"
  - "renamingStepId"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경: renamingDraft, renamingStepId
- 변경 상태 `renamingDraft, renamingStepId` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `pushHistory`, `renderPipeline`, `scheduleLogicAutoBackup`
- 피호출(영향 전파 경로): `renderPipeline`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
