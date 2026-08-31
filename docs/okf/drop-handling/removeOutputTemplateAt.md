---
type: endpoint
title: removeOutputTemplateAt
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(idx)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "drop-handling.js:327-327"

# ── 입출력 ──
inputs:
  - "idx"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: activeOutputIndex, currentFileId, output, outputOriginal"
raises: []

# ── 유기적 관계 ──
calls:
  - "activateOutputTemplate"
  - "closeExcelMirrorForFileId"
  - "pushHistory"
  - "refreshChatState"
  - "refreshTabs"
  - "renderExcelViewer"
  - "renderOutputChip"
  - "selectFallbackFileAfterRemoval"
calls_external:
  - "splice"
  - "startsWith"
  - "warn"
called_by:
  - "openRunnerFileEditor"
  - "renderOutputChip"
reads:
  - "state.activeOutputIndex"
  - "state.currentFileId"
  - "state.output"
  - "state.outputOriginal"
  - "state.outputTemplates"
writes:
  - "activeOutputIndex"
  - "currentFileId"
  - "output"
  - "outputOriginal"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경: activeOutputIndex, currentFileId, output, outputOriginal
- 변경 상태 `activeOutputIndex, currentFileId, output, outputOriginal` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `activateOutputTemplate`, `closeExcelMirrorForFileId`, `pushHistory`, `refreshChatState`, `refreshTabs`, `renderExcelViewer`, `renderOutputChip`, `selectFallbackFileAfterRemoval`
- 피호출(영향 전파 경로): `openRunnerFileEditor`, `renderOutputChip`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
