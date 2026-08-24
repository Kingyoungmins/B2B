---
type: endpoint
title: clearViewerDragSelection
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.5"
loc: "chat-ui.js:355-355"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "상태 변경: selectedCell, selectedRange, selectedRanges, selectionAnchor"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "forEach"
  - "querySelectorAll"
  - "remove"
called_by:
  - "sendChat"
reads:
  - "state.selectedCell"
  - "state.selectedRange"
  - "state.selectedRanges"
  - "state.selectionAnchor"
writes:
  - "selectedCell"
  - "selectedRange"
  - "selectedRanges"
  - "selectionAnchor"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 상태 변경: selectedCell, selectedRange, selectedRanges, selectionAnchor
- 변경 상태 `selectedCell, selectedRange, selectedRanges, selectionAnchor` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `sendChat`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
