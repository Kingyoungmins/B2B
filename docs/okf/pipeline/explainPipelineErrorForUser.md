---
type: endpoint
title: explainPipelineErrorForUser
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(info)"
role: "[#2] 실행 오류를 코드 지식이 없는 사용자에게 풀어 설명한다(단발 LLM 호출, 대화 기록 무관)."
role_source: banner
version: "0.7.3"
loc: "pipeline.js:7554-7554"

# ── 입출력 ──
inputs:
  - "info"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_recordedLike"
  - "buildSheetStructureDigest"
  - "callLLMOneShot"
  - "getFile"
  - "latestUserRequestForSafety"
  - "push"
calls_external:
  - "Number"
  - "String"
  - "every"
  - "filter"
  - "find"
  - "isArray"
  - "join"
  - "slice"
  - "some"
  - "test"
  - "trim"
called_by:
  - "reportPipelineError"
reads:
  - "state.chatHistory"
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
[#2] 실행 오류를 코드 지식이 없는 사용자에게 풀어 설명한다(단발 LLM 호출, 대화 기록 무관).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_recordedLike`, `buildSheetStructureDigest`, `callLLMOneShot`, `getFile`, `latestUserRequestForSafety`, `push`
- 피호출(영향 전파 경로): `reportPipelineError`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
