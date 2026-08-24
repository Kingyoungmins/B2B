---
type: endpoint
title: _editPrefillPromptOf
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(step)"
role: "(사용자가 손댔으면 보존)."
role_source: banner
version: "0.7.4"
loc: "pipeline.js:3036-3036"

# ── 입출력 ──
inputs:
  - "step"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "stepChatOriginless"
calls_external:
  - "String"
  - "test"
  - "trim"
called_by:
  - "_applyEditPrefill"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(사용자가 손댔으면 보존).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `stepChatOriginless`
- 피호출(영향 전파 경로): `_applyEditPrefill`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
