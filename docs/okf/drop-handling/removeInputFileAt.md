---
type: endpoint
title: removeInputFileAt
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(idx)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "drop-handling.js:309-309"

# ── 입출력 ──
inputs:
  - "idx"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: currentFileId"
raises: []

# ── 유기적 관계 ──
calls:
  - "closeExcelMirrorForFileId"
  - "pushHistory"
  - "refreshChatState"
  - "refreshTabs"
  - "renderExcelViewer"
  - "renderInputList"
  - "selectFallbackFileAfterRemoval"
calls_external:
  - "splice"
  - "warn"
called_by:
  - "openRunnerFileEditor"
  - "renderInputList"
reads:
  - "state.currentFileId"
  - "state.inputs"
  - "state.inputsOriginal"
writes:
  - "currentFileId"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경: currentFileId
- 변경 상태 `currentFileId` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `closeExcelMirrorForFileId`, `pushHistory`, `refreshChatState`, `refreshTabs`, `renderExcelViewer`, `renderInputList`, `selectFallbackFileAfterRemoval`
- 피호출(영향 전파 경로): `openRunnerFileEditor`, `renderInputList`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
