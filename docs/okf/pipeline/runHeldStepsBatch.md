---
type: endpoint
title: runHeldStepsBatch
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(checkedIds, fingerprint)"
role: "토글과 같은 큐에 '단일 태스크'로 등록 — 배치 도중 다른 토글 클릭은 배치가 끝난 뒤 실행되고,"
role_source: banner
version: "0.8.0"
loc: "pipeline.js:5203-5203"

# ── 입출력 ──
inputs:
  - "checkedIds"
  - "fingerprint"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_runHeldStepsBatchImpl"
calls_external:
  - "async"
  - "then"
called_by:
  - "openBatchResumeModal"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
토글과 같은 큐에 '단일 태스크'로 등록 — 배치 도중 다른 토글 클릭은 배치가 끝난 뒤 실행되고,

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_runHeldStepsBatchImpl`
- 피호출(영향 전파 경로): `openBatchResumeModal`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
