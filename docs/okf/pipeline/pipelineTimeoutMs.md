---
type: endpoint
title: pipelineTimeoutMs
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "[사용자 지시] Python 대용량(60만 행 등) 완주를 위해 클라 HTTP 타임아웃을 사실상 제거(30일). 백엔드도 무제한."
role_source: banner
version: "0.7.3"
loc: "pipeline.js:1268-1268"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
called_by:
  - "_reapplyVbaPipelineToLiveImpl"
  - "runIsolatedLivePipelineSteps"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
[사용자 지시] Python 대용량(60만 행 등) 완주를 위해 클라 HTTP 타임아웃을 사실상 제거(30일). 백엔드도 무제한.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_reapplyVbaPipelineToLiveImpl`, `runIsolatedLivePipelineSteps`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
