---
type: endpoint
title: _deny
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(reason, extra)"
role: "[제보 2026-08-25] '수정했는데 왜 1단계부터 다시 도나' — 이 판정이 false 면 pristine 전체"
role_source: banner
version: "0.8.2"
loc: "pipeline.js:5436-5436"

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
  - "traceClientUiEvent"
calls_external: []
called_by:
  - "canUsePipelineCheckpointFromIndex"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
[제보 2026-08-25] '수정했는데 왜 1단계부터 다시 도나' — 이 판정이 false 면 pristine 전체

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `traceClientUiEvent`
- 피호출(영향 전파 경로): `canUsePipelineCheckpointFromIndex`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
