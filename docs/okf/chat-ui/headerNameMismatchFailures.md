---
type: endpoint
title: headerNameMismatchFailures
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code, sourceUserMessage)"
role: "차단(앞 단계가 헤더를 새로 써 넣는 스킬을 막지 않기 위해) ③ 이름이 실제로 있으면 통과."
role_source: banner
version: "0.8.0"
loc: "chat-ui.js:516-516"

# ── 입출력 ──
inputs:
  - "code"
  - "sourceUserMessage"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "headersOf"
  - "norm"
  - "push"
calls_external:
  - "Set"
  - "String"
  - "filter"
  - "from"
  - "isArray"
  - "join"
  - "map"
  - "matchAll"
  - "min"
  - "replace"
  - "slice"
  - "some"
  - "startsWith"
  - "test"
  - "toLowerCase"
  - "trim"
called_by:
  - "pipelineHeaderMismatchReport"
  - "validateAssistantCodeBeforeApply"
reads:
  - "state.inputs"
  - "state.outputTemplates"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
차단(앞 단계가 헤더를 새로 써 넣는 스킬을 막지 않기 위해) ③ 이름이 실제로 있으면 통과.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `headersOf`, `norm`, `push`
- 피호출(영향 전파 경로): `pipelineHeaderMismatchReport`, `validateAssistantCodeBeforeApply`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
