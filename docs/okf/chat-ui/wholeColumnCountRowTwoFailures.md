---
type: endpoint
title: wholeColumnCountRowTwoFailures
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code, sourceUserMessage)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "chat-ui.js:408-408"

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
  - "_indentLen"
  - "_stripPythonCommentsForGate"
  - "_stripVbaCommentsForGate"
  - "add"
  - "appendSameFormatSheetsIntent"
  - "codeHasBroadValueRewrite"
  - "colIndex"
  - "columnCopyClearIntent"
  - "columnMoveIntent"
  - "conditionalRowDeleteIntent"
  - "ctxHelperPreferredIntent"
  - "ctxSortIntent"
  - "dedupeIntent"
  - "duplicateRowDeleteIntent"
  - "dynamicRangeTextIsWide"
  - "estimateCells"
  - "excelColumnLetterToIndex"
  - "filterToNewSheetIntent"
  - "hideUnhideIntent"
  - "isBenignRepeatedCodeLine"
  - "isHardVbaStaticFailure"
  - "isNewSheetWriteLine"
  - "lookupJoinIntent"
  - "monthShiftIntent"
  - "multiValueLookupIntent"
  - "negativeSignLossFailures"
  - "numericArithmeticIntent"
  - "pivotIntent"
  - "push"
  - "pythonComStaticSafetyFailures"
  - "pythonDegenerateOutputFailure"
  - "requestedExcelColumnLetters"
  - "routingIntentText"
  - "sheetOpIntent"
  - "shouldRouteRequestToPython"
  - "shouldRouteRequestToVba"
  - "shouldRouteSimpleStructureEditToPython"
  - "simpleRangeArithmeticIntent"
  - "simpleValueWriteIntent"
  - "splitColumnIntent"
  - "totalRowIntent"
  - "userExplicitlyRequestsForceProceed"
  - "userExplicitlyRequestsVba"
  - "userRequestsAbsoluteValue"
  - "userRequestsSort"
  - "vbaStaticSafetyFailures"
calls_external:
  - "CLng"
  - "COM"
  - "Cells"
  - "Columns"
  - "CreateObject"
  - "DateSerial"
  - "End"
  - "Len"
  - "Map"
  - "NEGATIVE_ABS_OK"
  - "Next"
  - "Number"
  - "O"
  - "Python"
  - "Range"
  - "RegExp"
  - "Rows"
  - "Set"
  - "SpecialCells"
  - "String"
  - "True"
  - "VBA"
  - "Workbooks"
  - "Worksheets"
  - "X"
  - "abs"
  - "b"
  - "book"
  - "charCodeAt"
  - "clear"
  - "compile"
  - "copy"
  - "dataArr"
  - "del"
  - "exec"
  - "f"
  - "filter"
  - "from"
  - "get"
  - "has"
called_by:
  - "validateAssistantCodeBeforeApply"
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
- 호출: `_indentLen`, `_stripPythonCommentsForGate`, `_stripVbaCommentsForGate`, `add`, `appendSameFormatSheetsIntent`, `codeHasBroadValueRewrite`, `colIndex`, `columnCopyClearIntent`, `columnMoveIntent`, `conditionalRowDeleteIntent`, `ctxHelperPreferredIntent`, `ctxSortIntent`, `dedupeIntent`, `duplicateRowDeleteIntent`, `dynamicRangeTextIsWide`, `estimateCells`, `excelColumnLetterToIndex`, `filterToNewSheetIntent`, `hideUnhideIntent`, `isBenignRepeatedCodeLine`, `isHardVbaStaticFailure`, `isNewSheetWriteLine`, `lookupJoinIntent`, `monthShiftIntent`, `multiValueLookupIntent`, `negativeSignLossFailures`, `numericArithmeticIntent`, `pivotIntent`, `push`, `pythonComStaticSafetyFailures`, `pythonDegenerateOutputFailure`, `requestedExcelColumnLetters`, `routingIntentText`, `sheetOpIntent`, `shouldRouteRequestToPython`, `shouldRouteRequestToVba`, `shouldRouteSimpleStructureEditToPython`, `simpleRangeArithmeticIntent`, `simpleValueWriteIntent`, `splitColumnIntent`, `totalRowIntent`, `userExplicitlyRequestsForceProceed`, `userExplicitlyRequestsVba`, `userRequestsAbsoluteValue`, `userRequestsSort`, `vbaStaticSafetyFailures`
- 피호출(영향 전파 경로): `validateAssistantCodeBeforeApply`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
