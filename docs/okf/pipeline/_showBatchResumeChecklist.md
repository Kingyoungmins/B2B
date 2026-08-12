---
type: endpoint
title: _showBatchResumeChecklist
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(info)"
role: "체크박스 모달. resolve: 체크된 stepId 배열 | null(취소)."
role_source: banner
version: "0.7.3"
loc: "pipeline.js:4582-4582"

# ── 입출력 ──
inputs:
  - "info"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "pipelineStepLabel"
  - "push"
  - "syncOk"
calls_external:
  - "Promise"
  - "String"
  - "__b2bCancel"
  - "addEventListener"
  - "appendChild"
  - "calc"
  - "createElement"
  - "done"
  - "filter"
  - "focus"
  - "forEach"
  - "getElementById"
  - "keydown"
  - "map"
  - "preventDefault"
  - "remove"
  - "removeEventListener"
  - "resolve"
  - "rgba"
  - "slice"
  - "split"
  - "stopPropagation"
  - "trim"
called_by:
  - "openBatchResumeModal"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
체크박스 모달. resolve: 체크된 stepId 배열 | null(취소).

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `pipelineStepLabel`, `push`, `syncOk`
- 피호출(영향 전파 경로): `openBatchResumeModal`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
