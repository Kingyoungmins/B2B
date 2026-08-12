---
type: endpoint
title: wrapSheets
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(sheetsObj)"
role: "유사도 매칭 Proxy로 감싸기 (item 1)."
role_source: banner
version: "0.7.3"
loc: "pipeline.js:2963-2963"

# ── 입출력 ──
inputs:
  - "sheetsObj"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "fuzzyProxy"
calls_external: []
called_by:
  - "computeStateBeforeStep"
  - "runPipeline"
reads:
  - "state.fuzzyResolution"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
유사도 매칭 Proxy로 감싸기 (item 1).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `fuzzyProxy`
- 피호출(영향 전파 경로): `computeStateBeforeStep`, `runPipeline`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
