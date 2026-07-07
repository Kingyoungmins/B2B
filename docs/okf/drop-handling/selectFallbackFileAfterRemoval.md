---
type: endpoint
title: selectFallbackFileAfterRemoval
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "현재 보던 파일을 닫은 뒤, 남은 파일로 전환해 그 미러를 즉시 표시한다."
role_source: banner
version: "0.5.19"
loc: "drop-handling.js:271-271"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: currentFileId, currentSheet, selectedCell, selectedRange, selectedRanges, selectionAnchor"
raises: []

# ── 유기적 관계 ──
calls:
  - "hideAllExcelMirrorWindows"
calls_external: []
called_by:
  - "removeInputFileAt"
  - "removeOutputTemplateAt"
reads:
  - "state.currentFileId"
  - "state.currentSheet"
  - "state.selectedCell"
  - "state.selectedRange"
  - "state.selectedRanges"
  - "state.selectionAnchor"
writes:
  - "currentFileId"
  - "currentSheet"
  - "selectedCell"
  - "selectedRange"
  - "selectedRanges"
  - "selectionAnchor"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
현재 보던 파일을 닫은 뒤, 남은 파일로 전환해 그 미러를 즉시 표시한다.

## 사이드이펙트 & 주의
- 상태 변경: currentFileId, currentSheet, selectedCell, selectedRange, selectedRanges, selectionAnchor
- 변경 상태 `currentFileId, currentSheet, selectedCell, selectedRange, selectedRanges, selectionAnchor` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `hideAllExcelMirrorWindows`
- 피호출(영향 전파 경로): `removeInputFileAt`, `removeOutputTemplateAt`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
