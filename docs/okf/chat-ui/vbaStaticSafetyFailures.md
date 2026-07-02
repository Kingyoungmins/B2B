---
type: endpoint
title: vbaStaticSafetyFailures
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code, sourceUserMessage)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "chat-ui.js:972-972"

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
  - "_stripVbaCommentsForGate"
  - "add"
  - "conditionalRowDeleteIntent"
  - "duplicateRowDeleteIntent"
  - "excelColumnLetterToIndex"
  - "filterToNewSheetIntent"
  - "multiValueLookupIntent"
  - "negativeSignLossFailures"
  - "push"
  - "requestedExcelColumnLetters"
  - "userExplicitlyRequestsForceProceed"
calls_external:
  - "CLng"
  - "Cells"
  - "Columns"
  - "CreateObject"
  - "DateSerial"
  - "End"
  - "Len"
  - "Map"
  - "Number"
  - "Range"
  - "RegExp"
  - "Rows"
  - "Set"
  - "SpecialCells"
  - "String"
  - "Workbooks"
  - "Worksheets"
  - "b"
  - "dataArr"
  - "del"
  - "exec"
  - "filter"
  - "get"
  - "has"
  - "includes"
  - "join"
  - "map"
  - "r"
  - "replace"
  - "set"
  - "some"
  - "sort"
  - "split"
  - "test"
  - "toLowerCase"
  - "toUpperCase"
called_by:
  - "pipelineStaticFailuresForCode"
  - "validateAssistantCodeBeforeApply"
  - "wholeColumnCountRowTwoFailures"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_stripVbaCommentsForGate`, `add`, `conditionalRowDeleteIntent`, `duplicateRowDeleteIntent`, `excelColumnLetterToIndex`, `filterToNewSheetIntent`, `multiValueLookupIntent`, `negativeSignLossFailures`, `push`, `requestedExcelColumnLetters`, `userExplicitlyRequestsForceProceed`
- 피호출(영향 전파 경로): `pipelineStaticFailuresForCode`, `validateAssistantCodeBeforeApply`, `wholeColumnCountRowTwoFailures`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
