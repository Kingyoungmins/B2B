---
type: endpoint
title: pipelineStepLabel
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(step, idx)"
role: "스킬 카드 라벨: 제목(description)이 비었거나 제네릭(\"스킬 생성\")이거나 코드 첫 줄이면"
role_source: banner
version: "0.7.4"
loc: "pipeline.js:3623-3623"

# ── 입출력 ──
inputs:
  - "step"
  - "idx"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "slice"
  - "startsWith"
  - "test"
  - "trim"
called_by:
  - "_showBatchResumeChecklist"
  - "renderPipeline"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
스킬 카드 라벨: 제목(description)이 비었거나 제네릭("스킬 생성")이거나 코드 첫 줄이면

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_showBatchResumeChecklist`, `renderPipeline`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
