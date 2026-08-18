---
type: endpoint
title: assistEnsureDom
module: assist-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "assist-ui.js:43-43"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "상태 변경: assist"
raises: []

# ── 유기적 관계 ──
calls:
  - "assistAbortCurrent"
  - "assistAddMsg"
  - "assistBindDrag"
  - "assistClearAttachments"
  - "assistIsBusy"
  - "assistLoadRect"
  - "assistRenderAttachments"
  - "assistRenderChips"
  - "assistSetStatus"
  - "assistSubmit"
  - "assistToggleDrawer"
  - "assistUploadAttachments"
  - "hideAllExcelMirrorWindows"
  - "push"
  - "scheduleRestoreActiveExcelMirror"
  - "send"
calls_external:
  - "String"
  - "addEventListener"
  - "appendChild"
  - "async"
  - "click"
  - "createElement"
  - "forEach"
  - "from"
  - "getElementById"
  - "join"
  - "map"
  - "max"
  - "preventDefault"
  - "slice"
  - "trim"
called_by:
  - "assistToggleDrawer"
reads:
  - "state.assist"
writes:
  - "assist"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 상태 변경: assist
- 변경 상태 `assist` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `assistAbortCurrent`, `assistAddMsg`, `assistBindDrag`, `assistClearAttachments`, `assistIsBusy`, `assistLoadRect`, `assistRenderAttachments`, `assistRenderChips`, `assistSetStatus`, `assistSubmit`, `assistToggleDrawer`, `assistUploadAttachments`, `hideAllExcelMirrorWindows`, `push`, `scheduleRestoreActiveExcelMirror`, `send`
- 피호출(영향 전파 경로): `assistToggleDrawer`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
