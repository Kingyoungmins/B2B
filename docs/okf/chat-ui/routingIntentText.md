---
type: endpoint
title: routingIntentText
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "라우팅 '의도' 판정용: @범위/@컬럼/@시트[...] 안의 파일명·시트명·범위를 제거한다."
role_source: banner
version: "0.8.1"
loc: "chat-ui.js:784-784"

# ── 입출력 ──
inputs:
  - "text"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "replace"
called_by:
  - "appendSameFormatSheetsIntent"
  - "clearDataIntent"
  - "columnCopyClearIntent"
  - "columnCopyIntent"
  - "columnMoveIntent"
  - "columnSwapIntent"
  - "conditionalRowDeleteIntent"
  - "copyValuesIntent"
  - "ctxSortIntent"
  - "dedupeIntent"
  - "duplicateRowDeleteIntent"
  - "fillSumColIntent"
  - "filterToNewSheetIntent"
  - "hideUnhideIntent"
  - "lookupJoinIntent"
  - "matchFillIntent"
  - "monthShiftIntent"
  - "pivotIntent"
  - "sheetOpIntent"
  - "shouldRouteRequestToPython"
  - "shouldRouteRequestToVba"
  - "shouldRouteSimpleStructureEditToPython"
  - "simpleRangeArithmeticIntent"
  - "simpleValueWriteIntent"
  - "splitColumnIntent"
  - "totalRowIntent"
  - "userExplicitlyRequestsForceProceed"
  - "vbaStaticSafetyFailures"
  - "wholeColumnCountRowTwoFailures"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
라우팅 '의도' 판정용: @범위/@컬럼/@시트[...] 안의 파일명·시트명·범위를 제거한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `appendSameFormatSheetsIntent`, `clearDataIntent`, `columnCopyClearIntent`, `columnCopyIntent`, `columnMoveIntent`, `columnSwapIntent`, `conditionalRowDeleteIntent`, `copyValuesIntent`, `ctxSortIntent`, `dedupeIntent`, `duplicateRowDeleteIntent`, `fillSumColIntent`, `filterToNewSheetIntent`, `hideUnhideIntent`, `lookupJoinIntent`, `matchFillIntent`, `monthShiftIntent`, `pivotIntent`, `sheetOpIntent`, `shouldRouteRequestToPython`, `shouldRouteRequestToVba`, `shouldRouteSimpleStructureEditToPython`, `simpleRangeArithmeticIntent`, `simpleValueWriteIntent`, `splitColumnIntent`, `totalRowIntent`, `userExplicitlyRequestsForceProceed`, `vbaStaticSafetyFailures`, `wholeColumnCountRowTwoFailures`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
