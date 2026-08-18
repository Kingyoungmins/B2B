---
type: endpoint
title: assistPrepareReportBundle
module: assist-report.js
lang: js
extraction: regex   # 정규식 근사
signature: "(meta)"
role: "제보 패키지를 만들어 다운로드한다. 사용자 버튼 클릭에서만 호출할 것."
role_source: banner
version: "0.7.4"
loc: "assist-report.js:124-124"

# ── 입출력 ──
inputs:
  - "meta"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "assistBuildConversationText"
  - "assistBuildDiagnosticsText"
  - "assistBuildJiraGuideText"
  - "assistReportTimestamp"
  - "buildLogicZipEntries"
  - "createZipBlob"
  - "downloadZip"
  - "push"
calls_external:
  - "Error"
  - "String"
  - "Uint8Array"
  - "arrayBuffer"
  - "encodeURIComponent"
  - "fetch"
  - "forEach"
  - "join"
  - "slice"
  - "trim"
  - "zip"
called_by:
  - "assistHandleBridgeMessage"
  - "assistRenderReportCard"
reads:
  - "state.inputsOriginal"
  - "state.logicSaveBaseName"
  - "state.outputTemplates"
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
제보 패키지를 만들어 다운로드한다. 사용자 버튼 클릭에서만 호출할 것.

## 사이드이펙트 & 주의
- 네트워크/서버 호출

## 관계
- 호출: `assistBuildConversationText`, `assistBuildDiagnosticsText`, `assistBuildJiraGuideText`, `assistReportTimestamp`, `buildLogicZipEntries`, `createZipBlob`, `downloadZip`, `push`
- 피호출(영향 전파 경로): `assistHandleBridgeMessage`, `assistRenderReportCard`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
