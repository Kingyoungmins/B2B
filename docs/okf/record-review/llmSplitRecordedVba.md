---
type: endpoint
title: llmSplitRecordedVba
module: record-review.js
lang: js
extraction: regex   # 정규식 근사
signature: "(entry, meta)"
role: "녹화된 단일 VBA 스텝을 업무 의도 단위 N조각으로 분할한다. 실패/검증불가 시 null(원본 유지)."
role_source: banner
version: "0.8.0"
loc: "record-review.js:599-599"

# ── 입출력 ──
inputs:
  - "entry"
  - "meta"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_chunkNeedsClipboard"
  - "_diag"
  - "_extractVbaCode"
  - "_mergeVbaChunkPair"
  - "_recordedAssignRhsMultiset"
  - "_recordedIntentNeeded"
  - "_recordedMultisetContains"
  - "_stripSynthesizedSheetSelects"
  - "callLLMOneShot"
  - "mergeInvariantSignature"
  - "push"
calls_external:
  - "B2B_NewSheetN"
  - "OK"
  - "Set"
  - "Sheets"
  - "String"
  - "cleaned"
  - "exec"
  - "filter"
  - "has"
  - "includes"
  - "info"
  - "isArray"
  - "join"
  - "map"
  - "match"
  - "parse"
  - "splice"
  - "steps"
  - "stringify"
  - "test"
  - "trim"
  - "warn"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
녹화된 단일 VBA 스텝을 업무 의도 단위 N조각으로 분할한다. 실패/검증불가 시 null(원본 유지).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_chunkNeedsClipboard`, `_diag`, `_extractVbaCode`, `_mergeVbaChunkPair`, `_recordedAssignRhsMultiset`, `_recordedIntentNeeded`, `_recordedMultisetContains`, `_stripSynthesizedSheetSelects`, `callLLMOneShot`, `mergeInvariantSignature`, `push`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
