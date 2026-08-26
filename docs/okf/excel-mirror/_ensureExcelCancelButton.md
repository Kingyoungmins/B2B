---
type: endpoint
title: _ensureExcelCancelButton
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "[#19] 작업 중단 버튼은 작업 중인 채팅 말풍선의 액션 버튼 옆에 붙인다."
role_source: banner
version: "0.8.0"
loc: "excel-mirror.js:1341-1341"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "cancelActiveBackendPipeline"
  - "requestExcelApplyCancel"
  - "setExcelMirrorApplyLoadingProgress"
  - "traceClientUiEvent"
calls_external:
  - "String"
  - "appendChild"
  - "createElement"
  - "getElementById"
  - "resolve"
  - "then"
called_by:
  - "showExcelApplyCancelButton"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[#19] 작업 중단 버튼은 작업 중인 채팅 말풍선의 액션 버튼 옆에 붙인다.

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `cancelActiveBackendPipeline`, `requestExcelApplyCancel`, `setExcelMirrorApplyLoadingProgress`, `traceClientUiEvent`
- 피호출(영향 전파 경로): `showExcelApplyCancelButton`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
