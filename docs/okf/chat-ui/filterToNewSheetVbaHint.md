---
type: endpoint
title: filterToNewSheetVbaHint
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(sourceUserMessage)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "chat-ui.js:1893-1893"

# ── 입출력 ──
inputs:
  - "sourceUserMessage"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "filterToNewSheetIntent"
calls_external:
  - "SpecialCells"
  - "Subtotal"
  - "join"
called_by:
  - "autoRegenerateAsVbaFallback"
  - "buildPipelineAutoRepairPrompt"
  - "buildStaticSafetyRegenPrompt"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `filterToNewSheetIntent`
- 피호출(영향 전파 경로): `autoRegenerateAsVbaFallback`, `buildPipelineAutoRepairPrompt`, `buildStaticSafetyRegenPrompt`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
