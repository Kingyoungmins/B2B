---
type: endpoint
title: waitRestoreOrStall
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(restore, excelId, opts)"
role: "복귀가 끝날 때까지 기다리되, 진행이 stallMs 동안 '한 발짝도' 못 나가면 멈춤으로 본다."
role_source: banner
version: "0.7.3"
loc: "pipeline.js:1917-1917"

# ── 입출력 ──
inputs:
  - "restore"
  - "excelId"
  - "opts"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls:
  - "excelPipelineProgressSignature"
  - "fetchExcelPipelineProgress"
calls_external:
  - "Error"
  - "Promise"
  - "now"
  - "setTimeout"
  - "then"
called_by:
  - "requestExcelApplyCancel"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
복귀가 끝날 때까지 기다리되, 진행이 stallMs 동안 '한 발짝도' 못 나가면 멈춤으로 본다.

## 사이드이펙트 & 주의
- 타이머

## 관계
- 호출: `excelPipelineProgressSignature`, `fetchExcelPipelineProgress`
- 피호출(영향 전파 경로): `requestExcelApplyCancel`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
