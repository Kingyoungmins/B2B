---
type: endpoint
title: toggleEditStep
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(stepId)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.5"
loc: "pipeline.js:3092-3092"

# ── 입출력 ──
inputs:
  - "stepId"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: editingStepId"
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls:
  - "_applyEditPrefill"
  - "renderEditingBanner"
  - "renderPipeline"
  - "scrollChatToStepRequest"
  - "toast"
calls_external:
  - "findIndex"
  - "setTimeout"
called_by:
  - "renderEditingBanner"
  - "renderPipeline"
reads:
  - "state.editingStepId"
  - "state.pipeline"
writes:
  - "editingStepId"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경: editingStepId
- 타이머
- 변경 상태 `editingStepId` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_applyEditPrefill`, `renderEditingBanner`, `renderPipeline`, `scrollChatToStepRequest`, `toast`
- 피호출(영향 전파 경로): `renderEditingBanner`, `renderPipeline`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
