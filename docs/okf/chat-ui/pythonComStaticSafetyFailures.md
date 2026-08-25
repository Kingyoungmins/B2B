---
type: endpoint
title: pythonComStaticSafetyFailures
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code, sourceUserMessage)"
role: "ver0.5.2 4단계: Python COM 스킬용 클라이언트 정적 안전 검사(적용 직전 1차 게이트)."
role_source: banner
version: "0.8.0"
loc: "chat-ui.js:1577-1577"

# ── 입출력 ──
inputs:
  - "code"
  - "sourceUserMessage"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "_indentLen"
  - "_stripPythonCommentsForGate"
  - "add"
  - "colIndex"
  - "dynamicRangeTextIsWide"
  - "estimateCells"
  - "isBenignRepeatedCodeLine"
  - "negativeSignLossFailures"
  - "push"
  - "userRequestsSort"
calls_external:
  - "Number"
  - "O"
  - "RegExp"
  - "Set"
  - "String"
  - "True"
  - "abs"
  - "b"
  - "book"
  - "charCodeAt"
  - "clear"
  - "compile"
  - "copy"
  - "delete_rows_where"
  - "delete_sheet"
  - "exec"
  - "f"
  - "find"
  - "from"
  - "has"
  - "includes"
  - "input"
  - "isFinite"
  - "join"
  - "map"
  - "match"
  - "matchAll"
  - "read"
  - "reduce"
  - "replace"
  - "sort"
  - "sorted"
  - "split"
  - "test"
  - "toUpperCase"
  - "transform"
  - "trim"
  - "write"
called_by:
  - "pipelineStaticFailuresForCode"
  - "validateAssistantCodeBeforeApply"
  - "wholeColumnCountRowTwoFailures"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
ver0.5.2 4단계: Python COM 스킬용 클라이언트 정적 안전 검사(적용 직전 1차 게이트).

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `_indentLen`, `_stripPythonCommentsForGate`, `add`, `colIndex`, `dynamicRangeTextIsWide`, `estimateCells`, `isBenignRepeatedCodeLine`, `negativeSignLossFailures`, `push`, `userRequestsSort`
- 피호출(영향 전파 경로): `pipelineStaticFailuresForCode`, `validateAssistantCodeBeforeApply`, `wholeColumnCountRowTwoFailures`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
