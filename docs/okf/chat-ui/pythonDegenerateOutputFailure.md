---
type: endpoint
title: pythonDegenerateOutputFailure
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code)"
role: "[0.5.2 이식·하이브리드] degenerate 출력 감지 — 준-greedy 디코딩의 Qwen 이 같은 줄을 끝없이"
role_source: banner
version: "0.8.1"
loc: "chat-ui.js:1298-1298"

# ── 입출력 ──
inputs:
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "isBenignRepeatedCodeLine"
calls_external:
  - "String"
  - "split"
  - "trim"
called_by:
  - "validateAssistantCodeBeforeApply"
  - "wholeColumnCountRowTwoFailures"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
[0.5.2 이식·하이브리드] degenerate 출력 감지 — 준-greedy 디코딩의 Qwen 이 같은 줄을 끝없이

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `isBenignRepeatedCodeLine`
- 피호출(영향 전파 경로): `validateAssistantCodeBeforeApply`, `wholeColumnCountRowTwoFailures`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
