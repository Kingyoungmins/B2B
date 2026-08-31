---
type: endpoint
title: _diffLiveSignatureParts
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(prevParts, curParts)"
role: "가릴 수 없었다. 불일치일 때는 어느 스텝의 무엇이 달라졌는지까지 남긴다."
role_source: banner
version: "0.8.2"
loc: "pipeline.js:4393-4393"

# ── 입출력 ──
inputs:
  - "prevParts"
  - "curParts"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "push"
calls_external:
  - "Map"
  - "forEach"
  - "get"
  - "has"
  - "isArray"
  - "join"
  - "map"
  - "slice"
called_by:
  - "_handlePipelineStepToggleImpl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
가릴 수 없었다. 불일치일 때는 어느 스텝의 무엇이 달라졌는지까지 남긴다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `push`
- 피호출(영향 전파 경로): `_handlePipelineStepToggleImpl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
