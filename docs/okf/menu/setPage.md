---
type: endpoint
title: setPage
module: menu.js
lang: js
extraction: regex   # 정규식 근사
signature: "(page)"
role: "==================================================================="
role_source: banner
version: "0.5.19"
loc: "menu.js:4-4"

# ── 입출력 ──
inputs:
  - "page"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "상태 변경: currentPage, excelMirror.runnerHeadless"
raises: []

# ── 유기적 관계 ──
calls:
  - "$"
  - "closeMenu"
  - "hideAllExcelMirrorWindows"
  - "publishNativeRunnerMode"
  - "refreshTabs"
  - "renderExcelViewer"
  - "renderRunnerWorkflow"
  - "scheduleRestoreActiveExcelMirror"
calls_external:
  - "forEach"
  - "querySelectorAll"
  - "resolve"
  - "then"
  - "toggle"
called_by:
  - "renderRunnerWorkflow"
  - "showRunnerPipelineError"
reads:
  - "state.currentPage"
writes:
  - "currentPage"
  - "excelMirror.runnerHeadless"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
===================================================================

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 상태 변경: currentPage, excelMirror.runnerHeadless
- 변경 상태 `currentPage, excelMirror.runnerHeadless` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `$`, `closeMenu`, `hideAllExcelMirrorWindows`, `publishNativeRunnerMode`, `refreshTabs`, `renderExcelViewer`, `renderRunnerWorkflow`, `scheduleRestoreActiveExcelMirror`
- 피호출(영향 전파 경로): `renderRunnerWorkflow`, `showRunnerPipelineError`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
