---
type: endpoint
title: _traceMap
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(reason, extra)"
role: "[진단] '실행기 매핑이 생성기 재실행에 안 실려 옛 파일명으로 실패'(실측 2026-07-29 test_mapping)의"
role_source: banner
version: "0.8.0"
loc: "drop-handling.js:1899-1899"

# ── 입출력 ──
inputs:
  - "reason"
  - "extra"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "runnerMappingKnownFiles"
  - "traceClientUiEvent"
calls_external:
  - "String"
  - "keys"
called_by: []
reads:
  - "state.runnerMappingChecked"
  - "state.runnerMappingRunActive"
  - "state.runnerMappings"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[진단] '실행기 매핑이 생성기 재실행에 안 실려 옛 파일명으로 실패'(실측 2026-07-29 test_mapping)의

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `runnerMappingKnownFiles`, `traceClientUiEvent`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
