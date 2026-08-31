---
type: endpoint
title: assistHandleBridgeMessage
module: assist-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(m)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "assist-ui.js:642-642"

# ── 입출력 ──
inputs:
  - "m"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "상태 변경: assist, currentPage"
raises: []

# ── 유기적 관계 ──
calls:
  - "assistAbortCurrent"
  - "assistCommitProposal"
  - "assistHandleUserMessage"
  - "assistIsBusy"
  - "assistPrepareReportBundle"
  - "assistSendToPopup"
  - "assistSetButtonOn"
  - "assistToggleDrawer"
  - "setPage"
calls_external:
  - "String"
  - "busy"
  - "clearTimeout"
  - "focus"
  - "getElementById"
  - "isArray"
  - "map"
  - "resolve"
  - "slice"
  - "then"
called_by:
  - "assistEnsureNativeBridge"
reads:
  - "state.assist"
  - "state.currentPage"
writes:
  - "assist"
  - "currentPage"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 상태 변경: assist, currentPage
- 변경 상태 `assist, currentPage` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `assistAbortCurrent`, `assistCommitProposal`, `assistHandleUserMessage`, `assistIsBusy`, `assistPrepareReportBundle`, `assistSendToPopup`, `assistSetButtonOn`, `assistToggleDrawer`, `setPage`
- 피호출(영향 전파 경로): `assistEnsureNativeBridge`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
